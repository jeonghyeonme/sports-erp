import { Injectable } from '@nestjs/common';
import { ContractFileKind, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { todayKst, toKstDateString } from '../../common/date/kst-date';
import { AppException } from '../../common/exceptions/app.exception';
import { RequestUser } from '../../common/interfaces/request-user.interface';
import { recordAudit } from '../../prisma/audit';
import { PrismaService } from '../../prisma/prisma.service';
import { ATTACHMENT_MAX_BYTES } from '../posts/dto/attachment.dto';
import { badType, checkType, extensionOf, tooLarge } from '../posts/attachment-rules';
import { StorageService } from '../storage/storage.service';
import { retentionState } from './contract-retention';

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
 * 교체는 옛 행에 replacedAt을 남긴다. 저장소에서 지우는 경로는 D71의 정리 하나뿐이다(이관 완료 + 보존 끝 지남, 본사).
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
    const today = todayKst();
    const rounds = await this.prisma.contractRound.findMany({
      where: { branchId },
      orderBy: { roundNo: 'desc' },
      include: {
        creator: { select: { name: true } },
        files: {
          orderBy: { uploadedAt: 'desc' },
          include: { uploader: { select: { name: true } }, archiver: { select: { name: true } } },
        },
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
        // D71 — 보존 끝·실물 이관·정리
        ...retentionState(f, r, today),
        archivedAt: f.archivedAt?.toISOString(),
        archivedByName: f.archiver?.name,
        purgedAt: f.purgedAt?.toISOString(),
      })),
    }));
  }

  /**
   * D71 — 실물 이관 완료 표시(본사, 파일 하나씩, 보존 끝 전에도). 표시해도 보존 끝까지는 열람된다.
   * 계약 종료 지점에도 된다(끝난 계약을 위한 기능 — 올리기 차단과 다르다). 이미 표시했거나 정리된 파일은 409.
   */
  async archive(branchId: string, fileId: string, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const file = await tx.contractFile.findUnique({
        where: { id: fileId },
        include: { round: { select: { branchId: true, roundNo: true } } },
      });
      if (!file || file.round.branchId !== branchId) throw fileNotFound();
      // 동시에 두 번 눌러도 한 번만 — 아직 표시 안 됐을 때만 바꾼다.
      const { count } = await tx.contractFile.updateMany({
        where: { id: fileId, archivedAt: null, purgedAt: null },
        data: { archivedAt: new Date(), archivedBy: actorId },
      });
      if (count === 0) {
        throw new AppException('CONTRACT_FILE_ALREADY_ARCHIVED', '이미 실물 이관을 표시한 파일입니다.', 409);
      }
      await recordAudit(tx, {
        actorId,
        entity: 'Branch',
        entityId: branchId,
        action: 'CONTRACT_FILE_ARCHIVED',
        after: { roundNo: file.round.roundNo, kind: file.kind, fileName: file.fileName },
      });
      return { id: fileId };
    });
  }

  /**
   * D71 — 본사 보존 현황: 실물 이관이 필요한 파일(보존 끝 6개월 안 또는 지남, 미이관)과 정리할 수 있는 파일
   * (이관 완료 + 보존 끝 지남, 미정리). 계약 파일은 지점당 몇 개라 전부 읽어 날짜를 앱에서 계산한다 —
   * 보존 끝 계산(윤년 2/29 처리 포함)을 회차 표·처리 대기함과 한 함수로 맞추려는 것.
   */
  async retentionOverview() {
    const today = todayKst();
    const files = await this.prisma.contractFile.findMany({
      where: { purgedAt: null },
      include: {
        archiver: { select: { name: true } },
        round: { select: { roundNo: true, endAt: true, terminatedAt: true, branch: { select: { id: true, name: true } } } },
      },
      orderBy: { uploadedAt: 'asc' },
    });
    const rows = files.map((f) => ({
      id: f.id,
      branchId: f.round.branch.id,
      branchName: f.round.branch.name,
      roundNo: f.round.roundNo,
      kind: f.kind,
      fileName: f.fileName,
      replacedAt: f.replacedAt?.toISOString(),
      archivedAt: f.archivedAt?.toISOString(),
      archivedByName: f.archiver?.name,
      ...retentionState(f, f.round, today),
    }));
    const byRetention = (a: { retentionUntil: string }, b: { retentionUntil: string }) => a.retentionUntil.localeCompare(b.retentionUntil);
    return {
      archiveNeeded: rows.filter((r) => r.needsArchive).sort(byRetention),
      purgeCandidates: rows.filter((r) => r.archivedAt && r.retentionEnded).sort(byRetention),
    };
  }

  /**
   * D71 — 보존 끝난 시스템 파일 정리(본사). 고른 파일이 모두 "이관 완료 + 보존 끝 지남 + 미정리"여야 한다(아니면 409, 아무것도
   * 지우지 않는다). 행을 잠그고 다시 판정한 뒤 저장소에서 지우고 정리 기록을 남긴다 — 저장소 삭제가 실패하면 트랜잭션이
   * 되돌아가 기록도 남지 않는다(다시 누르면 된다, 저장소 삭제는 이미 없는 파일에도 실패하지 않는다).
   */
  async purge(fileIds: string[], actorId: string) {
    const today = todayKst();
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "ContractFile" WHERE "id" = ANY(${fileIds}) FOR UPDATE`;
        const files = await tx.contractFile.findMany({
          where: { id: { in: fileIds } },
          include: { round: { select: { branchId: true, roundNo: true, endAt: true, terminatedAt: true } } },
        });
        if (files.length !== new Set(fileIds).size) throw fileNotFound();
        const blocked = files.filter((f) => !f.archivedAt || f.purgedAt || !retentionState(f, f.round, today).retentionEnded);
        if (blocked.length > 0) {
          throw new AppException(
            'CONTRACT_FILE_NOT_PURGEABLE',
            `정리할 수 없는 파일이 있습니다(실물 이관 전이거나 보존 기간이 남았거나 이미 정리됨): ${blocked.map((f) => f.fileName).join(', ')}`,
            409,
          );
        }
        await this.storage.remove(files.map((f) => f.path));
        await tx.contractFile.updateMany({
          where: { id: { in: fileIds } },
          data: { purgedAt: new Date(), purgedBy: actorId },
        });
        for (const f of files) {
          await recordAudit(tx, {
            actorId,
            entity: 'Branch',
            entityId: f.round.branchId,
            action: 'CONTRACT_FILE_PURGED',
            after: { roundNo: f.round.roundNo, kind: f.kind, fileName: f.fileName },
          });
        }
        return { purged: files.length };
      },
      { timeout: 15_000 },
    );
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
    if (!file || file.round.branchId !== branchId) throw fileNotFound();
    // D71 — 정리된 파일은 저장소에 없다(행은 이관·정리 기록으로 남는다).
    if (file.purgedAt) {
      throw new AppException('CONTRACT_FILE_PURGED', '보존 기간이 끝나 시스템 파일을 정리했습니다. 실물 보관본을 확인하세요.', 410);
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

function fileNotFound() {
  return new AppException('CONTRACT_FILE_NOT_FOUND', '계약 파일을 찾을 수 없습니다.', 404);
}
