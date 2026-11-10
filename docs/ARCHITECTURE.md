# 아키텍처와 구현 계약

## 현재 구조

```text
React 화면
  ├─ localStorage: profile / timer / sessions / tasks
  ├─ sessionStorage: room code / opaque resume token
  ├─ Service Worker: 프로덕션 정적 셸 오프라인 캐시
  └─ Socket.IO ── Node.js / Express
                    ├─ Room Map
                    ├─ socket → room membership
                    └─ 30초 재접속 대기 토큰
```

프런트엔드는 `src/`, 공통 타입은 `shared/`, 서버는 `server/`다. 개발 시 Vite의 `/socket.io`·`/api` 프록시를 사용한다. 배포 빌드는 Express가 `dist/`를 제공한다. 현 서버는 지속 실행되는 Node 프로세스가 필요하며 Cloudflare Workers 같은 다른 런타임에 그대로 배포할 수 있다고 가정하지 않는다.

## 데이터 모델

| 데이터 | 필드 | 보관 |
|---|---|---|
| Profile | name, avatar, goal | localStorage |
| TimerState | id, startedAt, duration, remaining, deadline, status, mode, subject, kind, focusDuration, breakAvailable | localStorage |
| StudySession | id, startedAt, endedAt, seconds, mode, subject, taskId? | localStorage |
| StudyTask | id, title, minutes, createdAt, completed | localStorage |
| Room | code, name, members, capacity | 서버 메모리 |
| Member | id, name, avatar, status, online | 서버 메모리 |
| Resume token | 무작위 256-bit 토큰, 이전 socket id, 만료 타이머 | 클라이언트 sessionStorage 및 서버 활성 연결·재접속 대기 Map |

타이머는 매 tick마다 1씩 빼지 않고 deadline과 현재 시각의 차이로 계산한다. 일시 정지 시 남은 시간을 저장하고 deadline을 제거한다. 재개 시 새 deadline을 만든다. 현재 시각 자체가 사용자가 바꾼 기기 시각에 의존하므로 부정행위 방지용 시간이 아니다.

타이머 변경은 React 후속 effect를 기다리지 않고 즉시 저장한다. storage 이벤트를 받은 탭은 데이터를 다시 쓰지 않는다. 종료 직전에 저장된 타이머 id·상태·만료를 다시 확인하고, 세션 저장을 타이머 초기화보다 먼저 수행한다. 이미 기록된 id의 내용은 보존한다. 종료 시 세션 id로 중복 제거한다. 백업 복원도 id로 병합하고 기존 세션을 덮어쓰지 않는다. 여러 탭은 storage 이벤트로 같은 개인 타이머·기록을 공유한다. 동시 쓰기에 대한 분산 트랜잭션 보장은 없으므로 계정 기반 기록으로 확장할 때 서버 idempotency와 원자 저장이 필요하다.

5분 휴식도 같은 TimerState의 deadline·일시 정지·탭 동기화 경로를 사용한다. kind가 없는 기존 데이터는 focus로 읽는다. breakAvailable은 집중 종료 후 선택지를 복원하고, kind=break의 focusDuration은 종료 후 돌아갈 집중 길이(초)를 보관한다. 휴식은 StudySession을 만들지 않는다.

공부할 일은 `costu:tasks`에 보관하며 서버에 전송하지 않는다. 선택 시 타이머·기록의 선택적 taskId로 연결하고, 기록된 집중 초의 합에서 목표 분량을 뺀 나머지를 분으로 올림해 다음 집중 길이(최소 1분)로 사용한다. 수동 완료는 기록 시간을 만들지 않는다. 목표를 채운 할 일은 기록에서 완료를 계산한다. 진행 중인 타이머는 할 일 선택으로 덮어쓰지 않고, 현재 연결한 할 일은 완료·삭제를 막는다. 다른 탭의 할 일 삭제나 복원은 이미 시작한 타이머의 주제·길이를 바꾸지 않는다. 삭제 후에도 기록의 주제·taskId는 보존한다.

기존 version=1 JSON 백업에 선택적 tasks 배열을 추가했다. 오래된 백업은 할 일 없이 복원하고, 새 백업은 기록·계획을 id 기준으로 병합한다. 입력 전체 검증 후 저장하며, 일부 저장이 실패하면 성공으로 안내하지 않고 메모리에 유지한 데이터를 내보내도록 안내한다.

서재 초대는 Web Share API가 있으면 사용자의 버튼 클릭으로 공유 시트를 열고, 미지원·실패 시 링크 복사로 전환한다. 사용자가 공유를 취소하면 조용히 종료한다. 링크 복사도 별도 버튼으로 제공한다. 기록·설정 화면의 진행 중 타이머 패널은 남은 시간과 상태만 표시하며 집중 공간으로 복귀할 수 있다.

## 실시간 이벤트

| 방향 | 이벤트 | 입력/결과 |
|---|---|---|
| server → client | session | 재접속용 resumeToken |
| client → server | room:create | name, avatar, roomName → Reply |
| client → server | room:join | name, avatar, code → Reply |
| client → server | room:leave | 현재 socket의 방 퇴장 |
| client → server | presence:update | ready / focusing / away |
| client → server | reaction | 👏 / 🌱 / 🔥 / ☕ |
| server → room | room:update | 방 스냅샷 |
| server → room | reaction | memberId, emoji, at |

서버는 클라이언트가 임의로 보낸 memberId로 상태를 갱신하지 않는다. 실제 연결 socket의 소속만 바꾼다. 동일 socket은 한 방에만 속하며 방 생성·이동 시 이전 소속을 제거한다. 공개방 목록 조회 API는 없다.

단절 시 참가자를 offline으로 표시하고 30초 유예한다. 유예 중 동일 토큰으로 다시 연결하면 이전 자리를 새 socket으로 옮긴다. 서버가 이전 연결의 단절을 아직 감지하지 못한 경우에도 활성 토큰 Map으로 자리를 옮기고 이전 socket을 종료해 중복 참가를 막는다. handshake의 roomCode=null은 단절 중 퇴장 의사로 처리해 이전 자리를 제거한다. 토큰은 추측하기 어려운 임의 값이며 계정 인증이나 장기 로그인 세션은 아니다. 명시적 퇴장은 유예하지 않는다. 서버 재시작이나 유예 만료 후 재접속은 실패할 수 있다.

클라이언트는 네트워크 연결과 방 복귀 완료를 별도로 관리한다. 브라우저 offline 시 연결을 중단하고 online 시 다시 연결한다. 단절 중 presence·reaction·leave를 전송 큐에 넣지 않고, room:join 확인 후 현재 타이머에서 계산한 ready/focusing/away를 보낸다. 일시 정지와 휴식은 away다. 지난 참여 요청의 늦은 응답은 시도 번호로 무시한다. room:update는 현재 복귀하려는 코드와 일치할 때만 반영한다. 타임아웃은 복귀 코드를 지우지 않고 수동 재시도를 제공하며, 서버가 방 없음 등을 명시적으로 응답하면 복귀 정보를 해제한다.

## 보안·프라이버시 기본값

- 입력은 Zod로 타입·길이·허용 값을 검증한다.
- 메시지 크기를 4KB로 제한하고 socket별로 10초간 30회 이벤트 제한을 둔다.
- 방 1,000개, 방당 6명의 앱 수준 한도를 둔다. 이는 부하 검증된 수용량이 아니다.
- 브라우저 Origin은 요청 Host 또는 명시한 ALLOWED_ORIGINS와 일치해야 한다.
- 방 코드는 약 40-bit 공간이며 초대 권한과 비슷한 비밀값으로 취급한다. 외부 공개·검색 노출을 피한다.
- 카메라·마이크 권한은 Permissions-Policy에서도 차단한다. 현재 앱은 이를 요청하지 않는다.
- 사용자 입력은 React 텍스트로 렌더링하며 HTML 삽입을 사용하지 않는다.
- 외부 영상·음성·분석·광고·폰트 요청은 없다. 패키지 설치 시 레지스트리 연결은 개발 환경의 동작이다.
- 개인 기록은 서버에 업로드하지 않는다. 네트워크에서 서버가 IP를 볼 수 있다는 사실까지 사라지는 것은 아니다.
- 서버에는 애플리케이션 사용자 로그 수집을 추가하지 않았다. 호스팅 플랫폼 로그 정책은 배포 시 별도 확인한다.

공개 출시 전에 IP 단위 연결/시도 제한, 로드밸런서 Origin·TLS 설정, 운영 로그 최소화·보관 기간, 계정/신고가 필요한 서비스 범위, 개인정보 안내를 재검토한다. socket별 제한만으로 공격 방어가 완성됐다고 간주하지 않는다.

## 확장 순서

1. 같은 서버에서 비공개 소규모 검증.
2. 계정 및 DB에 세션 저장, 서버에서 소유권·idempotency 검증.
3. Redis adapter 등과 방 상태의 공유 저장 설계 후 다중 인스턴스 지원.
4. 실기기 배터리·발열·권한·OS 복귀 검증 후 기기 내 카메라 PoC.
5. 실제 수요가 확인되면 관리형 WebRTC/SFU 음성.

브라우저 백그라운드 타이머 제약: [MDN Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API). 실시간 연결 단절은 정상적으로 발생할 수 있다는 전제: [Socket.IO Handling disconnections](https://socket.io/docs/v4/tutorial/handling-disconnections).
