---
name: 나는야 피카소 — 교실 디자인
description: "흰 교실 벽 위에 칠판, 색종이 블록, 포스트잇을 붙여 만든 화면. getdesign의 figma DESIGN.md(흑백 바탕 + 큰 파스텔 색 블록 + 포스트잇)를 학교·교실·칠판 느낌으로 바꾼 버전."
source: "npx getdesign@latest add figma 를 바탕으로 수정"

colors:
  canvas: "#fbfaf7"        # 흰 교실 벽 (페이지 바탕)
  surface: "#ffffff"
  ink: "#1f1d1a"
  muted: "#6b655c"
  hairline: "#e6e2d9"
  board: "#2f4a3a"         # 칠판. 가장 진한 블록 (figma의 navy 블록 자리)
  board-frame: "#5a4632"   # 칠판 나무 틀, 분필받이
  chalk-ink: "#f2efe6"
  primary: "#2f6b4a"       # 주 버튼. figma의 검정 대신 칠판 초록
  block-lime: "#dceeb1"    # 게시판
  block-cream: "#f4ecd6"   # 도화지
  block-mint: "#c8e6cd"
  block-pink: "#efd4d4"
  block-lilac: "#ddd2f6"
  block-yellow: "#fbf1b8"  # 포스트잇, 형광펜
  danger: "#b3362b"
  stamp: "#c9483a"         # 참 잘했어요 도장

typography:
  title: 문막초 달반체 — 로비 칠판 제목에만 (fonts/MunmakDalban.*)
  base: 문막초 해반체 — 나머지 모든 글자 (fonts/MunmakHaeban.*), 파일이 없을 때는 Pretendard
  note: 이 프로젝트는 사용자 요청으로 공통 규칙(Pretendard)의 예외
  display: 3.4em / 300 / line-height 1.05 / letter-spacing -0.035em
  eyebrow: 0.78em / 400 / letter-spacing 0.16em, 앞에 18px 가로선

rounded:
  sm: 6px    # 버튼, 칩
  md: 8px    # 입력칸, 카드, 칠판
  lg: 24px   # 색종이 블록
---

## 원칙

- 바탕은 흰 교실 벽(`canvas`)이고, 내용은 그 위에 붙인 **칠판, 색종이 블록, 포스트잇**으로 나눈다.
- 한 화면에 색종이 블록은 하나가 주인공이다. 블록 사이는 흰 벽으로 다시 돌아와 숨을 쉬게 한다.
- 위계는 굵기가 아니라 **크기**로 만든다. 큰 제목은 300 굵기에 자간을 좁게 쓴다.
- 섹션 시작에는 학교 말로 된 작은 라벨(eyebrow)을 단다: 수업 준비, 학생 참여, 출석 체크, 선생님 메모, 알림장, 오늘의 통지표.
- 그림자는 포스트잇과 팝업에만 살짝 쓴다. 색 블록 자체가 깊이를 만든다.

## 화면별 배치

| 화면 | 주인공 블록 | 교실 소품 |
|---|---|---|
| 로비 | 칠판 (날짜, 분필받이, 지우개) | 사용법 포스트잇 3장 |
| 교사 홈 | 게시판(lime) 통계 | 흰 카드 설정 폼 |
| 학생 참여 | 도화지(cream) | 이름표 |
| 대기실 | 민트 블록 | 칠판 방 코드, 명찰 칩, QR |
| 게임 | 칠판 상단 + 칠판 캔버스 | 색 분필 팔레트, 정답 공책, 포스트잇, 선생님 메모(lilac) |
| 결과 | 게시판(lime) 순위 | 포스트잇 칭찬 카드 + 참 잘했어요 도장 |

## 하지 않는 것 (figma 원본과 다른 점)

- 알약(pill) 버튼, 원형 아이콘 버튼 — 버튼은 6px 모서리로 유지
- font-weight 700 이상, 480/540 같은 중간 굵기 — 300과 400만
- 그라데이션
- 검정 주 버튼 — 주 버튼은 칠판 초록
- 한 화면에 색 블록 여러 개를 나란히 깔기

## 작은 화면

- 900px 이하: 게임은 한 줄로 쌓고, 블록 모서리 16px, 큰 제목은 2.5em.
- 버튼과 입력칸은 높이 46~48px 이상을 유지해 태블릿에서 누르기 쉽게 한다.
