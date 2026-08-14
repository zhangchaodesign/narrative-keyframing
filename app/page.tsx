import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BookOpenText,
  FileText,
  Github,
  Sparkles,
} from "lucide-react";

export default function HomePage() {
  return (
    <main className="landing-page min-h-screen overflow-hidden">
      <nav className="landing-nav" aria-label="Primary navigation">
        <Link
          href="/"
          className="wordmark"
          aria-label="Narrative Keyframing home"
        >
          <span>Narrative Keyframing</span>
        </Link>
        <div className="landing-nav-links">
          <Link href="/project">About the project</Link>
          <Link href="/tool" className="nav-tool-link">
            Open tool <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </nav>

      <section className="landing-hero">
        <div className="hero-copy">
          <h1>
            <em>Narrative Keyframing</em>
            <span>for Generative Creative Writing</span>
          </h1>
          <div className="hero-authors" aria-label="Authors">
            <a
              href="https://chaozhang.design/"
              target="_blank"
              rel="noreferrer"
              className="hero-author"
            >
              <Image
                src="/chao-zhang.jpg"
                alt="Chao Zhang"
                width={64}
                height={64}
              />
              <span>
                <strong>Chao Zhang</strong>
                <small>Cornell University</small>
              </span>
            </a>
            <a
              href="https://abedavis.com/"
              target="_blank"
              rel="noreferrer"
              className="hero-author"
            >
              <Image
                src="/abe-davis.png"
                alt="Abe Davis"
                width={64}
                height={64}
              />
              <span>
                <strong>Abe Davis</strong>
                <small>Cornell University</small>
              </span>
            </a>
          </div>
          <p className="hero-description">
            Inspired by keyframes in animation, Narrative Keyframing gives
            writers fine-grained control over plot, character arcs, and
            perspective, then leverages AI to interpolate these creative
            decisions into prose.
          </p>
          <div className="hero-resources" aria-label="Project resources">
            <a
              href="https://arxiv.org/abs/2608.10337"
              target="_blank"
              rel="noreferrer"
            >
              <FileText size={17} aria-hidden="true" />
              Paper
            </a>
            <a
              href="https://github.com/zhangchaodesign/narrative-keyframing"
              target="_blank"
              rel="noreferrer"
            >
              <Github size={17} aria-hidden="true" />
              GitHub
            </a>
          </div>
        </div>

        <div className="video-placeholder">
          <video
            className="homepage-video"
            src="/NarrativeKeyframing30s.mp4"
            autoPlay
            // muted
            loop
            playsInline
            preload="metadata"
            aria-label="Thirty-second preview of Narrative Keyframing"
          />
          <div className="video-paper-grain" aria-hidden="true" />
          <span className="video-kicker">30-second preview</span>
          <div className="video-title">
            <small>Narrative Keyframing · UIST 2026</small>
          </div>
        </div>
      </section>

      <section className="entry-grid" aria-label="Explore Narrative Keyframing">
        <Link href="/tool" className="entry-card entry-card-tool">
          <div className="entry-card-copy">
            <span className="entry-number">01</span>
            <span className="entry-icon">
              <Sparkles size={20} />
            </span>
            <h2>Enter the writing tool</h2>
            <p>
              Specify a set of narrative keyframes that describe import plot
              points, as well as character development and perspective, which AI
              can then interpolate with editable prose,
            </p>
            <span className="entry-action">
              Start creating <ArrowRight size={18} />
            </span>
          </div>
        </Link>

        <Link href="/project" className="entry-card entry-card-project">
          <div className="entry-card-copy">
            <span className="entry-number">02</span>
            <span className="entry-icon">
              <BookOpenText size={20} />
            </span>
            <h2>Explore the project</h2>
            <p>
              Read the research, explore the analogy between keyframing in
              animation and narrative, see how the three keyframe types connect,
              and learn what we discovered with writers.
            </p>
            <span className="entry-action">
              Read the story <ArrowRight size={18} />
            </span>
          </div>
        </Link>
      </section>

      <footer className="landing-footer">
        <span className="landing-authors">
          <span className="landing-avatar-stack" aria-hidden="true">
            <Image src="/chao-zhang.jpg" alt="" width={30} height={30} />
            <Image src="/abe-davis.png" alt="" width={30} height={30} />
          </span>
          Chao Zhang &amp; Abe Davis · Cornell University
        </span>
        <span className="footer-institution">
          <Image
            className="uist-logo"
            src="/uist_logo.png"
            alt="UIST"
            width={142}
            height={27}
          />
          <Image
            src="/cornell_logo.svg"
            alt="Cornell University"
            width={164}
            height={28}
          />
        </span>
      </footer>
    </main>
  );
}
