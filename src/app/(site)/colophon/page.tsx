import type { Metadata } from 'next'
import { readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import type { Photo } from '#content/types'
import { PipelineLadder, type Rung } from '@/components/pipeline-ladder'
import { ShaderPlayground } from '@/components/shader-playground'
import { SiteHeader } from '@/components/site-header'
import { PHOTO_LIST, ROUTE_LIST, getPhoto } from '@/lib/photos'
import styles from './colophon.module.css'

export const metadata: Metadata = {
  title: 'Colophon',
  description: 'How this site is built — the image pipeline, the traps, and the decisions.',
}

/**
 * 이 페이지의 수치는 빌드할 때 실제 파일을 재서 채운다.
 * 손으로 적어두면 다음 ingest에서 곧바로 거짓말이 되기 때문이다.
 */
async function measure() {
  const dir = path.join(process.cwd(), 'public', 'media')
  const totals = new Map<string, { count: number; bytes: number }>()

  for (const key of await readdir(dir).catch(() => [])) {
    for (const file of await readdir(path.join(dir, key)).catch(() => [])) {
      const ext = path.extname(file).slice(1)
      const { size } = await stat(path.join(dir, key, file))
      const bucket = totals.get(ext) ?? { count: 0, bytes: 0 }
      totals.set(ext, { count: bucket.count + 1, bytes: bucket.bytes + size })
    }
  }

  const rows = [...totals.entries()].sort((a, b) => b[1].bytes - a[1].bytes)
  const bytes = rows.reduce((sum, [, v]) => sum + v.bytes, 0)
  return { rows, bytes }
}

/** 한 장이 실제로 어떤 사다리로 구워졌는지. 파일을 직접 재서 넘긴다. */
async function ladder(photo: Photo): Promise<Rung[]> {
  const dir = path.join(process.cwd(), 'public', 'media', photo.key)
  const size = async (file: string) =>
    stat(path.join(dir, file)).then(
      (s) => s.size,
      () => null,
    )

  const rungs: Rung[] = []
  for (const width of photo.widths) {
    const avif = await size(`${width}.avif`)
    if (avif === null) continue
    rungs.push({ width, avif, webp: await size(`${width}.webp`) })
  }
  return rungs
}

const mb = (bytes: number) => `${(bytes / 1_048_576).toFixed(1)} MB`

/**
 * 여기만 손으로 적는다. Lighthouse 점수는 빌드 중에 잴 수 없기 때문이다.
 * 대신 언제 어떤 조건에서 쟀는지를 함께 적어 숫자가 늙는 걸 숨기지 않는다.
 */
const MEASURED_ON = '7 August 2026'
const MEASUREMENTS = [
  { route: '/', performance: 99, accessibility: 100, bestPractices: 100, seo: 100, lcp: '0.9s', tbt: '0ms' },
  { route: '/c/*', performance: 100, accessibility: 100, bestPractices: 100, seo: 100, lcp: '0.8s', tbt: '0ms' },
  { route: '/p/*', performance: 100, accessibility: 100, bestPractices: 100, seo: 100, lcp: '0.6s', tbt: '0ms' },
  { route: '/colophon', performance: 100, accessibility: 100, bestPractices: 100, seo: 100, lcp: '0.6s', tbt: '0ms' },
] as const

export default async function ColophonPage() {
  const media = await measure()

  /*
   * 데모용 사진. 대각선과 색이 뚜렷해야 왜곡과 번짐이 눈에 보인다 —
   * 하늘만 있는 사진에서는 무엇을 만져도 아무 일도 없어 보인다.
   */
  const demo = getPhoto('handrail-shadow') ?? PHOTO_LIST[0]
  const rungs = demo ? await ladder(demo) : []

  const live = PHOTO_LIST.filter((p) => p.live).length
  const pixels = PHOTO_LIST.reduce((sum, p) => sum + p.width * p.height, 0)
  const focals = new Map<number, number>()
  for (const photo of PHOTO_LIST) {
    const value = photo.exif.focalLength35
    if (value !== null) focals.set(value, (focals.get(value) ?? 0) + 1)
  }

  return (
    <>
      <SiteHeader current="colophon" />
      <main className={styles.page}>
        <div className={styles.lede}>
          <h1>Colophon</h1>
          <p>
            VLUU was a Next.js and Sanity site. This is the second one — same photographs, nothing
            else carried over. No CMS, no runtime image service: the pictures are baked into the
            repository by a build script, and the site is static all the way down.
          </p>
        </div>

        <dl className={styles.figures}>
          <div className={styles.figure}>
            <dt>Frames</dt>
            <dd>
              {PHOTO_LIST.length} <small>of 90 shot</small>
            </dd>
          </div>
          <div className={styles.figure}>
            <dt>Live Photos</dt>
            <dd>{live}</dd>
          </div>
          <div className={styles.figure}>
            <dt>Source pixels</dt>
            <dd>
              {(pixels / 1_000_000).toFixed(0)} <small>megapixels</small>
            </dd>
          </div>
          <div className={styles.figure}>
            <dt>Shipped media</dt>
            <dd>{mb(media.bytes)}</dd>
          </div>
        </dl>

        <section className={styles.section}>
          <h2>The pipeline</h2>
          <p>
            Originals live outside git. <code>pnpm ingest</code> reads them, bakes a responsive set
            into <code>public/media</code>, and writes a manifest that the app imports like any other
            module. Run it twice and the second run changes nothing — the script hashes each source
            and skips what it has already seen.
          </p>
          <p>
            Three things went wrong on the way, and all three were quiet rather than loud. That is
            the interesting part: none of them threw.
          </p>

          <div className={styles.traps}>
            <div className={styles.trap}>
              <h3>sharp cannot open an iPhone HEIC</h3>
              <p>
                libvips reports HEIF input support, so the format table says yes. Then it refuses the
                actual file: a Live Photo HEIC carries 45 item references and libheif caps them at 16
                for safety. The fix is to decode through macOS <code>sips</code> to lossless PNG
                first, which turns the fallback into the primary path.
              </p>
            </div>

            <div className={styles.trap}>
              <h3>Portrait photographs are stored sideways</h3>
              <p>
                An iPhone writes the sensor&rsquo;s landscape pixels and a rotation tag, not a rotated
                image. Anything that ignores the tag renders all 68 frames lying on their side — which
                is exactly what the first contact sheet looked like. <code>sharp.rotate()</code> with
                no argument reads the tag and actually turns the pixels.
              </p>
            </div>

            <div className={styles.trap}>
              <h3>The clock was nine hours off</h3>
              <p>
                exifr applies <code>OffsetTimeOriginal</code> and hands back true UTC. Read those
                fields as wall clock and a nine-in-the-morning photograph in Asakusa becomes 00:26 —
                and every frame shot before 09:00 local falls into the previous day&rsquo;s leg. Since
                the routes on this site are grouped by date, that silently reshuffled the whole
                sequence. Nothing errored; the dates were simply wrong.
              </p>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <h2>What gets shipped</h2>
          <p>
            AVIF is the delivery path. WebP exists only for browsers that cannot read it, so it is
            baked at two widths instead of four — at equal quality it runs close to twice the size,
            and spending a third of the repository on a fallback for a sliver of traffic is a bad
            trade. Widths stop at 2048: a 3:4 portrait filling a 16-inch display needs 1675 pixels,
            and going to 2560 costs half again as many bytes for detail the viewer never shows.
          </p>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Format</th>
                  <th>Files</th>
                  <th>Size</th>
                  <th>Share</th>
                </tr>
              </thead>
              <tbody>
                {media.rows.map(([ext, row]) => (
                  <tr key={ext}>
                    <td>{ext}</td>
                    <td>{row.count}</td>
                    <td>{mb(row.bytes)}</td>
                    <td>{((row.bytes / media.bytes) * 100).toFixed(0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className={styles.section}>
          <h2>Measured</h2>
          <p>
            Lighthouse, desktop preset, production build, WebGL layer active, {MEASURED_ON}. Cumulative
            layout shift is 0 everywhere. These are a snapshot rather than a promise — the useful part
            is the shape of them: nothing blocks, nothing shifts, and the largest image arrives in well
            under a second.
          </p>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Route</th>
                  <th>Perf</th>
                  <th>A11y</th>
                  <th>Best</th>
                  <th>SEO</th>
                  <th>LCP</th>
                  <th>TBT</th>
                </tr>
              </thead>
              <tbody>
                {MEASUREMENTS.map((row) => (
                  <tr key={row.route}>
                    <td>{row.route}</td>
                    <td>{row.performance}</td>
                    <td>{row.accessibility}</td>
                    <td>{row.bestPractices}</td>
                    <td>{row.seo}</td>
                    <td>{row.lcp}</td>
                    <td>{row.tbt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            The accessibility score was not 100 to begin with. The muted grey used for labels sat at
            2.5:1 against white — quiet to look at, and below the 4.5:1 that makes text readable. The
            palette now has three steps and all of them clear it.
          </p>
          <p>
            One caveat worth stating, since measurement is easy to fake by choosing the right machine:
            run the same build under a software rasteriser and performance falls to the seventies.
            Script evaluation nearly triples, because the CPU is doing the GPU&rsquo;s job and
            everything else queues behind it. That number says something about the harness, not about
            the page — but a colophon that only prints the flattering run is not measurement, it is
            marketing.
          </p>
        </section>

        <section className={styles.section}>
          <h2>DOM first, canvas second</h2>
          <p>
            Every photograph here is a real <code>&lt;img&gt;</code> in a box with a fixed aspect ratio.
            Layout, reading order, alt text and layout shift are settled before any motion work begins.
            A single WebGL canvas then reads those elements&rsquo; positions each frame and draws planes
            in exactly the same place.
          </p>
          <p>
            <em>In exactly the same place</em> was a claim, not a fact. The canvas built its world from{' '}
            <code>window.innerWidth</code>, but a <code>position: fixed</code> element sized at 100%
            covers the layout viewport, which excludes the scrollbar. World 1280, box 1265 — a scale of
            0.988 that nothing corrected. The right-hand column was drawn{' '}
            <strong>11.7 pixels left of its own frame</strong>, and slid there the instant the canvas
            took over. It now measures the canvas rather than the window, so the two coordinate systems
            are the same one.
          </p>
          <p>
            That was worse on a phone than the number suggests. Mobile Safari collapses its address bar
            as you scroll, so <code>window.innerHeight</code> changes continuously while the fixed
            canvas does not. The vertical scale was drifting for the whole length of every scroll —
            which is what &ldquo;the photographs will not sit still&rdquo; actually was.
          </p>
          <p>
            It also takes its pixels from the DOM. The <code>&lt;img&gt;</code> has already chosen a
            width from its <code>srcset</code> and downloaded it, so that element becomes the texture —
            no second request, and no guessing at a size the browser had already worked out. The upshot
            is that the canvas ships <strong>zero photo data</strong> to the client.
          </p>
          <p>
            The handover happens one photograph at a time. A single global switch would hide every
            <code>&lt;img&gt;</code> the moment the canvas woke up, including the ones it could not draw
            yet — holes in the page for as long as the textures took. Instead each frame is handed over
            only once its texture is ready, and handed straight back if the context is lost.
          </p>
          <p>
            <strong>The fallback is not a degraded version. It is the site, with a layer removed.</strong>{' '}
            No WebGL, reduced motion, data saver, two cores, a small maximum texture size, a thrown
            exception, a lost context — each of those is a normal outcome, and each one lands on a page
            that was already finished.
          </p>
        </section>

        <section className={styles.section}>
          <h2>One number, wrong three times</h2>
          <p>
            The canvas skews and smears photographs in proportion to how fast they are moving. That one
            number was wrong in three different ways, and each was invisible in a screenshot.
          </p>
          <p>
            <strong>Wrong source.</strong> It came from the window&rsquo;s scroll position, which works
            on the index and does nothing at all on a route page — those scroll a container sideways
            while the window sits perfectly still. Measured, the shader velocity there was exactly zero;
            every effect built for that screen had never once run. It now measures what actually moved:
            each photograph&rsquo;s own position, frame to frame. Window scroll, sideways container
            scroll and the cursor all arrive through the same path, because <strong>movement on screen
            was always the thing the shader cared about</strong>.
          </p>
          <p>
            <strong>Wrong unit.</strong> It counted pixels per <em>frame</em> and never divided by
            time, so the same scroll produced a larger distortion whenever a frame ran long. Driving
            the page at a fixed 900 px/s and throttling only the CPU:
          </p>
          <pre className={styles.pre}>
            {`dt  8.6ms → 0.01240
dt 41.6ms → 0.01222   one frame runs long
dt  8.3ms → 0.01508   the next spikes 22%

steady 60fps  0.0081 – 0.0104   (1.3×)
under load    0.0078 – 0.0208   (2.7×)`}
          </pre>
          <p>
            The physical speed never changed. Everything in that range is the frame rate leaking into
            the picture, and on a phone — where frame times vary far more — it read as a photograph that
            would not settle. Velocity is now normalised to a 60 fps frame before anything sees it, so a
            dropped frame changes when the value arrives and never how large it is.
          </p>
          <p>
            <strong>Wrong place.</strong> The archive index is for reading, and something that ripples
            the entire time you scroll it is at war with that. Scroll now drives distortion only inside
            the route strip, where travelling sideways <em>is</em> the subject. On the index the motion
            belongs to your hand: the photograph under the cursor takes its velocity from yours, settles
            three pixels into its own frame, and leans up to three pixels after you — bounded by
            construction, so it can never cross the hairline the DOM drew around it.
          </p>
          <p>
            The blur that rides on that velocity was wrong twice before it was right. The first pass
            smeared across nine percent of the frame using five samples, which is not motion blur but a
            row of ghosts. Real movement produces a velocity around 0.04; a drag of roughly five pixels
            there is where it stops looking like an effect and starts looking like a shutter held open a
            moment too long. Anything faster is clamped, because a flick across the screen is half a
            viewport in one frame and would tear the picture in half.
          </p>
          <p>
            A plain mouse has no horizontal wheel, so the route pages were, until now, only passable
            with a trackpad. Vertical wheel is translated to sideways travel — and released again at
            either end, because eating events you cannot act on makes a page feel stuck.
          </p>
        </section>

        <section className={styles.wide}>
          <h2>Drive it yourself</h2>
          <p>
            The same shader, compiled from the same source the site uses. Push the velocity and watch
            the frame shear, bend at the edges, split its channels by about a pixel, and drag along its
            own direction of travel.
          </p>
          {demo ? <ShaderPlayground photo={demo} /> : null}
        </section>

        <section className={styles.wide}>
          <h2>What one photograph weighs</h2>
          <p>
            Every frame is baked into a ladder of widths at build time. Move the slider and the browser
            fetches that exact file — no <code>srcset</code>, no guessing, just the bytes that would go
            over the wire.
          </p>
          {demo && rungs.length > 0 ? <PipelineLadder photo={demo} rungs={rungs} /> : null}
        </section>

        <section className={styles.section}>
          <h2>Opening a photograph without leaving the page</h2>
          <p>
            Clicking a frame opens it over the index rather than replacing it. The URL still changes to{' '}
            <code>/p/…</code>, so the address remains shareable; refresh it and the full page renders
            instead. That split comes from intercepting and parallel routes — the modal is a route, not
            a piece of component state, so the back button closes it and a pasted link never opens a
            dialog with nothing behind it.
          </p>
          <p>
            Two things resisted. The canvas is a single fixed element covering the viewport, so it
            cannot live inside the modal — it has to sit <em>between</em> the veil and the modal&rsquo;s
            controls, and while a photograph is open the layer draws that one frame and hands the rest
            of the grid back to the DOM. And interception keys off the destination, not the origin:
            paging between two full photo pages was still being intercepted, stacking a modal on top of
            a viewer. Moving the route into its own group did not help, because route groups are not
            segments. The fix was to stop pretending — on the shareable page the neighbour links are
            plain anchors that load a document.
          </p>
          <p>
            <code>&lt;dialog&gt;</code> would have supplied the focus trap, the Escape key and the
            backdrop for free, but it renders in the top layer, above every z-index, which would bury
            the canvas drawing the photograph. So the shell is hand-built and the platform still does
            the hard part: <code>inert</code> on the background means focus cannot leave, without a
            single line of trap logic.
          </p>
        </section>

        <section className={styles.section}>
          <h2>Decisions worth arguing with</h2>
          <p>
            <strong>There is no dark theme.</strong> A white cube is the concept, not a default — the
            photographs are the only saturated thing on screen and a dark version cancels half of
            that. Committing to one world beats supporting two badly.
          </p>
          <p>
            <strong>Sequence comes from the camera, not from taste.</strong> Routes are trips, legs
            are days, and a frame&rsquo;s place is decided by when it was taken. No hand-kept ordering
            to drift out of date when new photographs arrive.
          </p>
          <p>
            <strong>The index was scattered before it was tidy, and scattered was wrong.</strong> Every
            frame here is exactly 3:4, so the first version varied the widths and nudged each picture
            down the page — on the theory that sixty-eight identical rectangles would be dull. It
            bought variety by spending every alignment line on the page, and what was left read as
            spillage rather than a collection. Uniform tiles are not a compromise for material like
            this; they are what it wants. The variety now comes from section structure and type, and
            the distortion under your cursor is easier to see, not harder, because there is finally a
            straight edge to distort.
          </p>
          <p>
            <strong>The route plot has no basemap, and it is drawn a day at a time.</strong> Sixty-seven
            of sixty-eight frames carry coordinates, so the routes can be drawn from the photographs
            themselves — but a map tile layer would drag a whole visual world in with it, and an
            external service besides. Points, lines and a scale bar are what a survey drawing has.
            The first version put each route on one sheet, which failed on its own honesty: the day
            trip to Lake Ashi is seventy kilometres out, so it set the scale and crushed the
            thirty-eight Tokyo frames into a corner. Each day now gets its own sheet at its own scale
            — 200 m for an afternoon in Yokohama, 10 km for the Romancecar — and the whole route
            stays as an overview. Ganghwa is a single coordinate twice over, so it gets a mark and no
            line; drawing one would be inventing a journey.
          </p>
          <p>
            <strong>22 frames were cut and the reasons kept.</strong> Duplicates, a museum wall label
            that was somebody else&rsquo;s work, a picture at one twelfth the resolution of the rest.
            The list lives in the repository so the question does not get relitigated.
          </p>
        </section>

        <section className={styles.section}>
          <h2>Made with</h2>
          <p>
            Next.js and React, TypeScript, CSS Modules with hand-written tokens. Type is Archivo,
            carrying a variable width axis, set against DM Mono for anything the camera recorded.
            Images through sharp, metadata through exifr, Live Photos through ffmpeg. Vitest for the
            pure logic, Playwright for the browser. {ROUTE_LIST.length} routes,{' '}
            {ROUTE_LIST.reduce((n, r) => n + r.legs.length, 0)} legs,{' '}
            {[...focals.entries()]
              .sort((a, b) => a[0] - b[0])
              .map(([mm, count]) => `${mm}mm ×${count}`)
              .join(', ')}
            .
          </p>
        </section>

        <p className={styles.contact}>
          <a href="mailto:jinhyuk9714@gmail.com">jinhyuk9714@gmail.com</a>
          <a href="https://github.com/sjh9714" rel="me noreferrer">
            GitHub
          </a>
          <a href="https://instagram.com/sungjinhyuk" rel="me noreferrer">
            Instagram
          </a>
          <span>Shot on iPhone 15 Pro</span>
        </p>
      </main>
    </>
  )
}
