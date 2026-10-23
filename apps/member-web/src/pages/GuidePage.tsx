import { Link } from 'react-router-dom';
import { DocPage } from '../components/DocPage';
import { CANCEL_DEADLINE_HOURS } from '../lib/format';

// 이용 안내 — RFP 과업4 "이용자 매뉴얼을 앱(게시판·안내페이지)에 탑재"(D51). 화면 이름은 하단 탭·버튼 글자 그대로 쓴다.
// 화면이 바뀌면 이 문구도 같이 고친다(관리자 웹 help-content.ts와 같은 규칙).
export function GuidePage() {
  return (
    <DocPage title="이용 안내" lead="스포이즘 회원 앱에서 할 수 있는 일과 순서입니다.">
      <section className="panel stack-sm">
        <h2 className="card-title">처음 시작하기</h2>
        <ol className="doc-steps">
          <li>
            지점 데스크에서 이미 회원 등록을 했다면 <strong>처음 오셨나요? → 지점에서 이미 회원 등록을 했어요</strong>에서 회원번호와 전화번호로
            계정을 연결합니다. 수강·PT 내역이 그대로 보입니다.
          </li>
          <li>
            아직 등록하지 않았다면 <strong>아직 등록하지 않았어요</strong>에서 다닐 지점을 고르고 가입합니다.
          </li>
          <li>홈 화면에 앱 아이콘을 추가하면 주소창 없이 바로 열 수 있습니다(홈의 "앱으로 설치하기" 카드).</li>
        </ol>
      </section>

      <section className="panel stack-sm">
        <h2 className="card-title">예약하고 결제하기</h2>
        <ol className="doc-steps">
          <li>
            하단 <strong>예약하기</strong> 탭에서 프로그램을 고르고, 원하는 회차를 누른 뒤 <strong>예약하기</strong>(유료는{' '}
            <strong>예약하고 결제하기</strong>)를 누릅니다.
          </li>
          <li>유료 회차는 바로 결제 화면으로 넘어갑니다. 결제해야 예약이 확정됩니다.</li>
          <li>
            예약은 <strong>내 예약</strong> 탭에서 봅니다. 수업 시작 {CANCEL_DEADLINE_HOURS}시간 전까지 취소하면 결제 금액을 모두 돌려받습니다. 그 뒤에도 취소는
            되지만 환불되지 않습니다(자리는 다른 회원에게 돌아갑니다). 지점에 따라 기준 시간이 다를 수 있습니다.
          </li>
          <li>정원이 찼거나 이미 시작한 회차, 같은 회차를 두 번 예약하는 것은 안 됩니다.</li>
        </ol>
      </section>

      <section className="panel stack-sm">
        <h2 className="card-title">시설 혼잡도와 공지</h2>
        <ul className="doc-steps">
          <li>
            <strong>홈</strong>에 다니는 지점의 시설별 혼잡도가 5단계(여유~매우 붐빔)로 보입니다. 진행 중인 강습의 예약 인원은 바로 더해지고, 예약 없이 이용하는 현장 인원은 지점 직원이 입력합니다.
          </li>
          <li>
            지점과 본사의 공지는 홈의 <strong>공지</strong> 카드에서 최근 3건을 보고, <strong>전체 보기</strong>로 지난 공지까지 봅니다.
          </li>
        </ul>
      </section>

      <section className="panel stack-sm">
        <h2 className="card-title">내 정보</h2>
        <ul className="doc-steps">
          <li>
            <strong>내 정보</strong> 탭에서 이름·연락처를 고치고, 수강 내역과 PT 남은 횟수를 봅니다.
          </li>
          <li>비밀번호는 내 정보 아래쪽에서 바꿉니다. 바꾸면 다른 기기의 로그인도 모두 끊깁니다.</li>
        </ul>
      </section>

      <section className="panel stack-sm">
        <h2 className="card-title">자주 묻는 것</h2>
        <ul className="doc-steps">
          <li>
            <strong>"계약이 종료된 지점"</strong>이라고 나오면 그 지점은 운영이 끝나 새 예약·가입을 받지 않습니다. 지난 기록은 계속 볼 수 있습니다.
          </li>
          <li>
            <strong>"잠시 후 다시 시도"</strong>가 나오면 사람이 몰린 순간입니다. 2~3초 뒤 다시 누르면 됩니다.
          </li>
          <li>연결이 끊기면 화면 위에 안내가 뜨고, 다시 연결되면 그대로 이어서 쓸 수 있습니다.</li>
        </ul>
      </section>

      <p className="login-links">
        <Link to="/privacy">개인정보처리방침</Link>
      </p>
    </DocPage>
  );
}
