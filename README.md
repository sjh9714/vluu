# VLUU

사진 68장을 담은 개인 갤러리. 아카이브 인덱스, 노선별 가로 시퀀스, 겹쳐 열리는 상세, 그리고 그 위에 얹은 WebGL 레이어.

라이브 사이트가 어떻게 만들어졌는지는 사이트 안의 [Colophon](/colophon)에 적혀 있다 — 이 README는 돌리는 법만 담는다.

## 돌리기

```bash
pnpm install
pnpm dev            # http://localhost:4321
```

포트가 4321인 이유가 있다. 기본 3000은 다른 앱이 물고 있을 때가 있고, 그러면 Playwright의
`reuseExistingServer`가 그걸 우리 서버로 착각해 **엉뚱한 앱을 테스트한다.**

## 검증

```bash
pnpm lint           # ESLint
pnpm typecheck      # tsc --noEmit
pnpm test           # Vitest — 순수 로직만
pnpm test:e2e       # Playwright — 프로덕션 빌드를 구워서 돈다
pnpm verify:media   # 콘텐츠 레이어와 실제 파일이 어긋나지 않는지
```

`test:e2e`는 매번 `pnpm build`부터 한다. 개발 서버를 상대로 돌리면 요청받은 순간 컴파일하느라
타이밍이 흔들리고, 무엇보다 낡은 서버가 옛 코드를 그대로 내보내 **테스트가 잘못된 이유로 통과한다.**

## 사진 추가하기

원본은 git에 들어가지 않는다. 파생물만 커밋된다.

```bash
photos-src/
  iphone-15-pro/     # 폴더 이름이 곧 장비 구분
  nikon-z50ii/
```

1. 원본을 위 폴더에 넣는다 (HEIC 그대로 괜찮다 — 자세한 건 `photos-src/README.md`)
2. `content/selection.ts`의 `SELECTED`에 파일명을 넣는다
3. `pnpm ingest` — 파생물과 매니페스트를 굽는다. 바뀐 것만 다시 굽는다
4. `content/photos.meta.ts`에 제목·대체텍스트·캡션을 쓴다
5. 여행이 새로 생겼다면 `content/routes.ts`에 노선을 더한다
6. `pnpm verify:media`로 빠진 게 없는지 확인한다

```bash
pnpm ingest --force   # 인코딩 설정을 바꿨을 때만. 전부 다시 굽는다
```

## 구조

```
photos-src/          원본 (gitignore)
content/             셀렉·메타데이터·노선. photos.generated.ts는 ingest가 만든다
scripts/             ingest 파이프라인, verify-media
src/gl/              WebGL 레이어 — DOM 좌표를 읽어 그 위에 그린다
src/components/      UI
src/app/(site)/      라우트. @modal 슬롯이 /p/[slug]를 가로채 모달로 연다
public/media/        구워진 파생물 (커밋됨)
```

## 배포

Vercel 기준. 빌드 설정은 기본값 그대로면 되고, 환경변수는 하나뿐이다.

```
NEXT_PUBLIC_SITE_URL=https://<배포 도메인>
```

사이트맵과 OG 메타데이터의 절대 주소에 쓰인다. 없으면 `http://localhost:4321`로 떨어진다.

CMS도 이미지 서비스도 붙어 있지 않다. 사진은 레포 안의 정적 파일이고 모든 라우트가 프리렌더된다.
