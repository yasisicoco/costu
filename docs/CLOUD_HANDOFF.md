# Codex Cloud 인계

최초 작성: 2026-11-04 KST. 저장소: https://github.com/yasisicoco/costu

## 현재 Cloud 개발 스냅샷

이 채팅을 costu의 주 개발 채팅으로 사용한다. 지정 저장소의 실제 Cloud 체크아웃 `/workspace/costu`에서 작업했다. 시작 당시 브랜치는 `work`, HEAD는 `d9dcffe`였고 작업 트리는 깨끗했다. origin은 `https://github.com/yasisicoco/costu.git`다.

- Cloud 상태: running/connected, 설정 관측 최신, 제한형 네트워크 정책 적용 확인.
- 실행 도구: Linux, Node.js v24.19.0, npm 11.9.0, 사전 설치 Chromium 154.0.8037.57.
- 기존 `package-lock.json`으로 `npm ci` 성공. lockfile·의존성 변경 없음.
- 수정 전 단위·서버 7개, 브라우저 9개, 타입 검사·빌드 통과. audit 취약점 0건.
- 1차 모바일·휴식·재접속 개선 후 단위·서버 11개, 브라우저 20개, 타입 검사·빌드 통과. audit 취약점 0건. `git diff --check` 통과.
- 검증한 변경은 `feat/study-plan-and-focus-flow` 개발 브랜치에서 관리한다. 실제 서비스 배포는 수행하지 않았다. AGENT.md·AGENTS.md는 추적되지 않는다. 소스 전달 상태는 아래 후속 기록과 git 상태를 확인한다.

이번 구현:

1. 모바일 본문·입력·버튼 글자와 대비 개선, 최소 44×44 CSS px 조작 영역, 320/390px 재배치.
2. 집중 기록 후 사용자가 선택하는 5분 휴식, 건너뛰기·일시 정지·재개·조기 종료·복원. 휴식은 기록·목표에서 제외하고 다음 집중을 자동 시작하지 않음.
3. 네트워크 연결과 방 복귀 완료 분리, 마지막 연결 상태 안내, 재연결 버튼, 단절 중 이벤트 큐 억제, 최신 타이머 상태 재전송.
4. 활성 연결·유예 토큰으로 자리 승계, 단절 감지 전 빠른 복귀의 중복 참가 방지, 오프라인 퇴장 의사 보존.
5. 타이머 변경 즉시 저장, 기록 저장 후 초기화, 완료 직전 저장 상태 확인, 기존 id 기록 보존, storage 이벤트 재저장 방지.

검증 범위는 Chromium의 320/390px 집중·서재·모달·설정·기록 화면, 터치 영역과 일반 텍스트 대비 4.5:1(큰 글자 3:1), 200% 확대에 해당하는 640 CSS px 재배치, 키보드 포커스 순환·복귀다. 휴식 선택·복원·만료·중도 종료, 다중 탭 동시 만료, 두 브라우저의 오프라인 일시 정지·만료·복귀, 휴식 상태 동기화, 오프라인 퇴장, 재접속 유예 만료도 검사했다. 자동 대비 검사는 일반 텍스트와 불투명 배경 기준이며 전체 WCAG 준수나 실제 스크린리더 검증을 뜻하지 않는다.

스크린샷은 `test-results/mobile-focus.png`, `mobile-320-room.png`, `mobile-390-room.png`, `desktop-focus.png`에 생성되며 집중 화면은 시각 확인했다. 테스트 출력은 git 제외 대상이다. `docs/preview/`는 최초 MVP 이미지로 남겨 두었다.

### 기능 개선 후속 기록

기획자·디자이너·개발자 서브에이전트와 기능을 기획하고 구현했다. 공부할 일에 제목·목표 분량을 저장하고 바로 집중을 시작한다. 조기 종료도 저장된 초만큼 진행률에 포함하며 남은 목표 분량으로 다시 시작한다. 수동 완료·목표 달성 표시, 완료 목록 접기, 삭제 후 기록 보존, 기존 v1 백업과 할 일 백업을 지원한다.

휴대폰 초대 공유 시트(취소 시 자동 복사 없음, 미지원·실패 시 복사 대안)와 기록·설정 화면의 진행 중 타이머 안내/복귀를 추가했다. 데이터 저장 실패 시 복원 성공으로 오인하지 않도록 안내하고, 현재 화면의 데이터를 내보낼 수 있다.

단위·서버 테스트 17개, 브라우저 29개 통과(전체 28개 후 신규 오프라인 시나리오를 포함한 할 일 테스트 9개 재검증). 타입 검사·빌드·audit·diff 검사 통과. 320/390px 할 일 목록과 진행 중 타이머 스크린샷을 확인했고 디자이너도 배치를 검토했다. 신규 출력은 `test-results/mobile-study-plan.png`, `mobile-study-plan-320.png`, `mobile-active-plan.png`다. 실제 휴대폰 공유 시트는 아직 실기기 검증 전이며, 브라우저 테스트에서는 성공·취소·실패를 주입해 검증했다.

### 소스 전달 및 다음 승인 지점

기능 구현 커밋 `1d6d8f8`을 개발 브랜치로 푸시했고 [초안 PR #1](https://github.com/yasisicoco/costu/pull/1)을 생성했다. CLI의 GitHub API 호출은 환경 정책에서 Forbidden이었지만 연결된 GitHub 도구로 PR 생성을 완료했다. 실제 서비스는 배포하지 않았다.

실기기 검증을 위한 검토용 `deploy/render.preview.yaml`과 `docs/PILOT.md`를 준비했다. PORT=3099에서 프로덕션 HTML·health·WebSocket 흐름을 확인했다. 추천은 결제수단·무료 한도를 확인한 Render Free의 짧은 친구 테스트이며 앱 URL 자체는 공개된다. 기존 개인 서버 또는 Cloud 내부 개발을 대안으로 둔다. 공개 범위·계정 결제 조건에 대한 사용자 승인 전에는 설정을 적용하거나 서비스를 생성하지 않는다.

### 이 환경의 재현 명령

```sh
npm ci
npm run check
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
npm audit
```

`npx playwright install chromium`은 cdn.playwright.dev에 대한 `403 Domain forbidden`으로 실패했다. 정책을 변경하지 않고 설치된 `/usr/bin/chromium`을 사용했다. 기본 Playwright 설치가 가능한 다른 환경에서는 환경 변수 없이 실행할 수 있다. 5173·3001 포트는 Playwright가 개발 서버를 실행해 사용한다.

남은 검증: 실제 iOS Safari·Android Chrome, OS 화면 잠금·장시간 백그라운드·배터리·클립보드·오디오, 실제 브라우저 확대·스크린리더. 서버 재시작 시 방 소멸과 localStorage 동시 쓰기의 트랜잭션 부재는 기존 한계다. 실제 서비스 배포·유료 자원·공개 범위는 결정하지 않았다.

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

## 최초 전달 당시 기록

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

## 최초 로컬 검증 기록

로컬 Windows / Node.js 22.12 / Chromium에서:

- 타입 검사와 프로덕션 빌드 성공.
- 단위·서버 테스트 7개 통과.
- 브라우저 테스트 9개 통과: 타이머/기록 복원, 실제 2브라우저 동기화, 만료 중복 방지, 모바일 화면, 키보드 모달, 혼자 있는 방 재접속, 백업 병합, 프로덕션 오프라인, 다른 탭 타이머 동기화.
- npm audit 알려진 취약점 0건.
- 데스크톱·390px 모바일 스크린샷 시각 확인.

빌드 시 Zod 패키지 내부 PURE 주석 위치에 대한 Rollup 경고가 두 건 나온다. 빌드는 성공하며 앱 소스의 오류는 아니다. 앱 코드에 설명용 주석을 추가하지 않았다.

최초 인계 당시에는 Cloud/Linux와 접근성 대비 측정이 미검증이었다. 현재 Cloud 검증은 상단 스냅샷을 따른다. 실제 iOS/Android, 실제 장시간 백그라운드, 공개 인터넷 부하 테스트는 여전히 미검증이다. 로그인, 원격 기록 DB, 카메라, 음성, 공개방, 앱스토어 패키지는 미구현이다.

## 이어서 할 일

1. 이 채팅에서 이어서 작업할 때 실제 저장소 변경 상태와 상단 재현 명령을 확인한다.
2. 실제 iOS Safari·Android Chrome에서 화면 잠금/복귀, 초대 링크, 재접속, 클립보드, 배경음을 검증한다.
3. 실제 브라우저 확대·스크린리더·동작 줄이기 설정과 전체 접근성 검토를 이어간다.
4. 파일럿 공개가 필요해질 때 현재 스냅샷·선택지·추천안을 함께 제시하고 공개 범위·비용·호스팅을 승인받는다.

기능 범위를 늘리기 전에 PRD의 가설을 검증한다. 사용자 지시에 따라 중대한 비용·보안·데이터 손실·공개 범위 결정만 승인받고, 통상적인 기획·디자인·구현·검증은 자율적으로 진행한다.
