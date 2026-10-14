import { Link } from 'react-router-dom';
import { DocPage } from '../components/DocPage';

// 개인정보처리방침 — RFP 보안요건(개인정보 보호법 제26조 업무위탁) 대응(D51). 시연용 초안이다.
// 항목은 실제 저장하는 것만 적는다(회원: Member·Account, 열람 기록: D47). 수집 항목·위탁처가 바뀌면 이 화면을 함께 고친다.
export function PrivacyPage() {
  return (
    <DocPage title="개인정보처리방침" lead="시연용 초안입니다. 실제 시행 전에 회사 확인과 법률 검토를 거쳐 확정합니다.">
      <section className="panel stack-sm">
        <h2 className="card-title">1. 수집하는 항목과 목적</h2>
        <table className="doc-table">
          <thead>
            <tr>
              <th>항목</th>
              <th>목적</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>이름, 연락처, 생년월일, 성별(선택)</td>
              <td>회원 확인, 지점의 안내 연락, 미성년 여부 확인</td>
            </tr>
            <tr>
              <td>이메일, 비밀번호(암호화 저장)</td>
              <td>로그인</td>
            </tr>
            <tr>
              <td>다니는 지점, 회원번호, 수강·PT·예약·결제 내역</td>
              <td>프로그램 이용과 예약·환불 처리</td>
            </tr>
            <tr>
              <td>법정대리인 동의 여부(만 19세 미만)</td>
              <td>미성년 회원 가입 요건 확인</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="panel stack-sm">
        <h2 className="card-title">2. 누가 볼 수 있나</h2>
        <ul className="doc-steps">
          <li>회원 정보는 다니는 지점의 관리자와 본사 관리자만 봅니다. 다른 지점은 볼 수 없습니다.</li>
          <li>목록 화면의 전화번호는 가운데를 가려(010-****-1234) 보여 줍니다.</li>
          <li>관리자가 회원 상세 정보를 열면 누가 언제 열었는지 기록하고, 본사가 오남용을 점검합니다. 이 기록은 1년 보관합니다.</li>
        </ul>
      </section>

      <section className="panel stack-sm">
        <h2 className="card-title">3. 보관 기간</h2>
        <ul className="doc-steps">
          <li>회원 정보는 탈퇴할 때까지 보관합니다. 탈퇴하면 로그인이 즉시 막힙니다.</li>
          <li>예약·결제 내역은 환불·분쟁 처리와 관계 법령에 따른 기간 동안 보관한 뒤 파기합니다.</li>
        </ul>
      </section>

      <section className="panel stack-sm">
        <h2 className="card-title">4. 처리 위탁(개인정보 보호법 제26조)</h2>
        <p className="muted">서비스 운영을 위해 아래 업체에 데이터 보관·전송을 맡깁니다. 위탁받은 업체는 정해진 목적 밖으로 쓸 수 없습니다.</p>
        <table className="doc-table">
          <thead>
            <tr>
              <th>업체</th>
              <th>맡긴 일</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Supabase</td>
              <td>데이터베이스 보관(서울 리전)</td>
            </tr>
            <tr>
              <td>Amazon Web Services</td>
              <td>서버 운영(서울 리전)</td>
            </tr>
            <tr>
              <td>Cloudflare</td>
              <td>화면 전송, 접속 보호</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="panel stack-sm">
        <h2 className="card-title">5. 내 정보 확인·수정·탈퇴</h2>
        <ul className="doc-steps">
          <li>
            이름·연락처는 <strong>내 정보</strong>에서 직접 고칠 수 있습니다.
          </li>
          <li>그 밖의 정정이나 탈퇴는 다니는 지점 데스크에 요청합니다.</li>
        </ul>
      </section>

      <p className="login-links">
        <Link to="/guide">이용 안내</Link>
      </p>
    </DocPage>
  );
}
