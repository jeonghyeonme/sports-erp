import { Injectable } from '@nestjs/common';
import { ContractFileKind, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { toKstDateString } from '../../common/date/kst-date';
import { AppException } from '../../common/exceptions/app.exception';
import { RequestUser } from '../../common/interfaces/request-user.interface';
import { recordAudit } from '../../prisma/audit';
import { PrismaService } from '../../prisma/prisma.service';
import { ATTACHMENT_MAX_BYTES } from '../posts/dto/attachment.dto';
import { badType, checkType, extensionOf, tooLarge } from '../posts/attachment-rules';
import { StorageService } from '../storage/storage.service';

type Tx = Prisma.TransactionClient;

/** 저장소에서 다시 확인한 계약 파일 — 회차에 붙일 때 그대로 행이 된다. */
export interface VerifiedContractFile {
  path: string;
  fileName: string;
  fileType: string;
  fileSize: number;
}

export const CONTRACT_FILE_LABEL: Record<ContractFileKind, string> = {
  CONTRACT: '계약서',
  TERMINATION_AGREEMENT: '해지 합의서',
};

/**
 * 위탁계약 회차의 계약 파일 — D69. 저장은 게시판 첨부와 같은 저장소·한도(D57): 브라우저가 서명 URL로 직접 올리고,
 * api는 업로드 URL 발급과 올라온 파일의 크기·형식 재확인만 한다. 경로는 계약 전용(`contracts/`)이다.
 * 올리기·교체는 본사만(컨트롤러 @Roles), 열람은 본사와 자기 지점 관리자. 열람할 때마다 기록을 남긴다(D69 결정 8).
 * 파일을 지우는 경로는 없다 — 교체는 옛 행에 replacedAt을 남긴다.
 */
@Injectable()
export class ContractFileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async requestUpload(input: { fileName: string; fileType: string; fileSize: number }) {
    const ext = extensionOf(input.fileName);
    checkType(ext, input.fileType);
    if (input.fileSize > ATTACHMENT_MAX_BYTES) throw tooLarge();
    const path = `contracts/${randomUUID()}.${ext}`;
    return { path, uploadUrl: await this.storage.createUploadUrl(path), maxBytes: ATTACHMENT_MAX_BYTES };
  }

  /** 1단계에서 받은 경로에 파일이 실제로 올라왔는지, 크기·형식이 맞는지 저장소에서 다시 본다. 트랜잭션 밖에서 부른다. */
  async verify(input: { path: string; fileName: string }): Promise<VerifiedContractFile> {
    const ext = extensionOf(input.path);
    if (extensionOf(input.fileName) !== ext) throw badType();
    const info = await this.storage.info(input.path);
    if (!info) throw new AppException('ATTACHMENT_NOT_UPLOADED', '파일이 아직 올라가지 않았습니다. 다시 올려 주세요.', 409);
    if (info.size > ATTACHMENT_MAX_BYTES) throw tooLarge();
    const fileType = (info.contentType ?? '').split(';')[0].trim();
    checkType(ext, fileType);
    return { path: input.path, fileName: input.fileName.trim(), fileType: fileType || 'application/octet-stream', fileSize: info.size };
  }

  /**
   * 회차에 파일을 붙인다. 같은 종류의 지금 파일이 있으면 교체로 처리한다(옛 행 replacedAt). 같은 경로를 두 번 붙이면 409.
   * 이력은 부르는 쪽 트랜잭션 안에서 함께 남긴다.
   */
  async attach(tx: Tx, roundId: string, kind: ContractFileKind, file: VerifiedContractFile, actorId: string) {
    const replaced = await tx.contractFile.updateMany({
      where: { roundId, kind, replacedAt: null },
      data: { replacedAt: new Date() },
    });
    try {
      await tx.contractFile.create({ data: { roundId, kind, ...file, uploadedBy: actorId } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new AppException('ATTACHMENT_DUPLICATE', '이미 붙인 파일입니다. 다시 올려 주세요.', 409);
      }
      throw e;
    }
    return { replaced: replaced.count > 0 };
  }

  /** 지점의 회차 전부(최근 회차부터)와 파일 — 지난 회차·교체된 파일도 읽기 전용으로 보인다. */
  async listRounds(branchId: string) {
    const rounds = await this.prisma.contractRound.findMany({
      where: { branchId },
      orderBy: { roundNo: 'desc' },
      include: {
        creator: { select: { name: true } },
        files: { orderBy: { uploadedAt: 'desc' }, include: { uploader: { select: { name: true } } } },
      },
    });
    return rounds.map((r, i) => ({
      id: r.id,
      roundNo: r.roundNo,
      current: i === 0,
      contractPartner: r.partner,
      contractStartAt: toKstDateString(r.startAt),
      contractEndAt: toKstDateString(r.endAt),
      terminatedAt: r.terminatedAt ? toKstDateString(r.terminatedAt) : undefined,
      createdByName: r.creator?.name,
      createdAt: r.createdAt.toISOString(),
      files: r.files.map((f) => ({
        id: f.id,
        kind: f.kind,
        fileName: f.fileName,
        fileType: f.fileType,
        fileSize: f.fileSize,
        uploadedByName: f.uploader.name,
        uploadedAt: f.uploadedAt.toISOString(),
        replacedAt: f.replacedAt?.toISOString(),
      })),
    }));
  }

  /**
   * 60초짜리 다운로드 URL. 다른 지점의 파일 id를 이 지점 경로로 부르면 404(존재를 드러내지 않는다).
   * D69 결정 8 — URL을 주기 전에 열람 기록을 남긴다. 기록이 실패하면 URL도 주지 않는다(D47과 같은 태도).
   */
  async downloadUrl(branchId: string, fileId: string, viewer: RequestUser): Promise<{ url: string; expiresInSec: number }> {
    const file = await this.prisma.contractFile.findUnique({
      where: { id: fileId },
      include: { round: { select: { branchId: true, roundNo: true } } },
    });
    if (!file || file.round.branchId !== branchId) {
      throw new AppException('CONTRACT_FILE_NOT_FOUND', '계약 파일을 찾을 수 없습니다.', 404);
    }
    await recordAudit(this.prisma, {
      actorId: viewer.accountId,
      entity: 'Branch',
      entityId: branchId,
      action: 'CONTRACT_FILE_VIEWED',
      after: { roundNo: file.round.roundNo, kind: file.kind, fileName: file.fileName },
    });
    return { url: await this.storage.createDownloadUrl(file.path, file.fileName, 60), expiresInSec: 60 };
  }
}
