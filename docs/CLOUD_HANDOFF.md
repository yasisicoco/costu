# Codex Cloud 인계

2026-11-04 KST. 저장소: https://github.com/yasisicoco/costu

## 사용자 방침

다른 프로젝트 대화에서 사용자가 “이 프로젝트는 cloud에서 진행하자. 이 프로젝트의 다른 대화에도 이걸 전달해줘”라고 요청한 내용이 이 대화로 전달됐다. 이후 개발은 **Codex Cloud 실행 환경**에서 이어간다. 이것은 서비스 호스팅 제공업체 결정이나 앱 공개 승인과 다르다.

사용자가 이후 “내 개인 공개 레포에 만들고 거기서 해줘”라고 명시적으로 승인했다. 개인 계정 yasisicoco의 공개 costu 저장소를 생성하고 현재 소스를 전달한다. 실제 서비스 배포와 유료 리소스 생성은 별도 승인 대상이다. AGENT.md와 AGENTS.md를 커밋하거나 푸시하지 않는다.

## 현재 산출물

비어 있던 작업 폴더에 React/TypeScript 모바일 대응 웹앱 및 Node.js 실시간 서버를 작성했다. 개인 타이머, 기록, 목표, 4종 아바타, 초대 링크/코드 기반 최대 6명 서재, 실시간 상태/응원, 재접속, JSON 백업, 오프라인 개인 집중이 구현돼 있다.

기획 전 단계의 가설·추천안은 `docs/PRD.md`, 기술 계약은 `docs/ARCHITECTURE.md`, 후속 작업과 반복 검증은 `docs/BACKLOG.md`에 있다. 이는 고객 검증이나 앱스토어 출시가 완료됐다는 뜻이 아니다.

소스 구조:

```text
src/App.tsx                 주요 화면과 타이머·소켓 상태 연결
src/styles.css              반응형 디자인
src/components/             Avatar, StudyScene, Modal
src/lib/study.ts             타이머와 통계 순수 함수
src/lib/storage.ts           기기 저장 데이터·백업 검증
src/sw.template.js           배포용 오프라인 캐시 템플릿
server/app.ts               실시간 방과 검증·Origin 제한·재접속
server/index.ts             서버 실행 및 빌드 정적 제공
shared/types.ts             공통 모델
tests/*.test.ts             타이머·서버 회귀 테스트
tests/e2e/app.spec.ts        실제 브라우저 시나리오
docs/preview/               검증 중 촬영한 데스크톱·모바일 초기 화면
```

## Cloud로 옮기기 전 필요한 사항

GitHub 재인증 후 yasisicoco 계정 조회가 성공했다. 소스 전달 대상은 사용자가 승인한 공개 저장소 yasisicoco/costu다. 이 문서를 준비할 때 조회된 Codex Cloud 환경은 0개로, 저장소 생성·푸시만으로 기존 로컬 대화가 Cloud로 이동하지는 않는다.

원격 소스를 사용할 Codex Cloud 환경을 생성한 뒤 아래 명령으로 재현 검증한다. GitHub Connector가 조직 PrainIT의 선택된 저장소만 조회하는 경우 개인 계정의 costu 저장소 접근 설정을 추가로 확인한다. 기존 저장소의 코드를 덮어쓰지 않는다.

전달 대상은 소스·설정·문서·`package-lock.json`이다. 제외 대상은 `.gitignore` 기준의 node_modules, dist, 테스트 출력, 환경 변수, AGENT.md, AGENTS.md다. 현재 `.env`나 인증정보 파일을 작성하지 않았다.

## Cloud 초기 실행

Node.js 22.12 이상과 npm을 사용한다.

```sh
npm ci
npm run test
npm run build
npx playwright install --with-deps chromium
npm run test:e2e
npm audit
```

개발은 `npm run dev`로 시작한다. 5173은 Vite, 3001은 Express/Socket.IO다. 실제 테스트 시 두 포트가 비어 있어야 한다. Playwright는 자체적으로 개발 서버를 실행하고 종료한다. Cloud의 브라우저/네트워크/프리뷰 지원 여부는 해당 환경에서 확인한다.

빌드 실행은 `npm run build` 다음 `npm start`다. 현재 서버는 메모리 기반 단일 Node.js 프로세스이므로 다른 런타임으로 이전할 경우 어댑테이션이 필요하다. Cloud 개발 환경과 실제 서비스의 배포 서버를 혼동하지 않는다.

## 검증 현황

로컬 Windows / Node.js 22.12 / Chromium에서:

- 타입 검사와 프로덕션 빌드 성공.
- 단위·서버 테스트 7개 통과.
- 브라우저 테스트 9개 통과: 타이머/기록 복원, 실제 2브라우저 동기화, 만료 중복 방지, 모바일 화면, 키보드 모달, 혼자 있는 방 재접속, 백업 병합, 프로덕션 오프라인, 다른 탭 타이머 동기화.
- npm audit 알려진 취약점 0건.
- 데스크톱·390px 모바일 스크린샷 시각 확인.

빌드 시 Zod 패키지 내부 PURE 주석 위치에 대한 Rollup 경고가 두 건 나온다. 빌드는 성공하며 앱 소스의 오류는 아니다. 앱 코드에 설명용 주석을 추가하지 않았다.

Cloud/Linux, 실제 iOS/Android, 접근성 대비 측정, 실제 장시간 백그라운드, 공개 인터넷 부하 테스트는 미검증이다. 로그인, 원격 기록 DB, 카메라, 음성, 공개방, 앱스토어 패키지는 미구현이다.

## 이어서 할 일

1. 저장소·Cloud 환경 연결을 확인한다. 외부 전송 승인 없이 푸시하지 않는다.
2. 위 명령으로 현재 상태를 재현한다. 실패가 있으면 기능 추가보다 먼저 해결한다.
3. 실기기 화면 잠금/복귀, 초대 링크, 연결 단절, 음성 배경음 제약을 확인한다.
4. 텍스트 대비·확대·터치 타깃을 측정해 접근성을 개선한다.
5. 파일럿 공개가 필요해질 때만 공개 범위·비용·호스팅을 사용자에게 결정받는다.

기능 범위를 늘리기 전에 PRD의 가설을 검증한다. 무기한 자율 실행을 보장한다고 말하지 않고, 실행 가능한 다음 작업과 외부 결정이 필요한 작업을 구분한다.
