# 선택형 표정 연결의 제3자 구성요소

- @vladmandic/human 3.3.6: MIT. 고정 버전과 npm lockfile integrity로 설치한다. 라이선스는 public/licenses/human-LICENSE.txt에 보관한다.
- Human 번들 내부 TensorFlow.js: Apache-2.0. 라이선스는 public/licenses/tensorflowjs-LICENSE.txt에 보관한다.
- 얼굴 검출·기하점 모델: Human 패키지에 포함된 MediaPipe BlazeFace와 FaceMesh 변환 모델만 사용한다. 원본과 변환의 설명은 https://github.com/vladmandic/human/wiki/Models 를 따른다.

scripts/prepare-face-models.mjs는 npm 패키지의 blazeface.json/bin과 facemesh.json/bin만 public/face-models로 복사한다. 생성 파일은 git에서 제외하고 npm ci/dev/build 때 재현한다. 브라우저는 앱과 같은 Origin에서만 모델을 받는다. 다른 모델(감정·나이·성별·얼굴 식별·홍채·신체·손·생체 판정)은 로드하거나 실행하지 않는다.

카메라 브라우저 검증은 공개 도메인 NASA 사진의 가상 MediaStream 입력을 사용한다. 사용자 촬영물이 아니며 입력 사진은 앱 화면에 표시하거나 서버에 전송하지 않는다. 출처는 tests/fixtures/README.md에 있다. 테스트 출력 아바타는 실제 기기 카메라 인식률·배터리 검증과 구분한다.
