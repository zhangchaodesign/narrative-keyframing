import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  FileText,
  Github,
  Sparkles,
} from "lucide-react";
import { PreviewVideo } from "@/components/PreviewVideo";

export const metadata: Metadata = {
  title: "Narrative Keyframing",
  description:
    "Narrative Keyframing for Generative Creative Writing, a research project from Cornell University.",
};

const citation = `@inproceedings{zhang2026narrative,
  author    = {Zhang, Chao and Davis, Abe},
  title     = {Narrative Keyframing for Generative Creative Writing},
  booktitle = {The 39th Annual ACM Symposium on User Interface Software and Technology},
  year      = {2026},
  pages     = {1--19},
  doi       = {10.1145/3830398.3830586}
}`;

export default function ProjectPage() {
  return (
    <main className="project-page min-h-screen">
      <nav className="project-nav" aria-label="Project navigation">
        <Link href="/" className="project-back">
          <ArrowLeft size={16} aria-hidden="true" /> Home
        </Link>
        <Link href="/tool" className="project-tool-link">
          Open the tool <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </nav>

      <article className="project-paper">
        <header className="project-paper-header">
          <h1>
            <span className="project-title-key">Narrative Keyframing</span>
            <span className="project-title-rest">
              for Generative Creative Writing
            </span>
          </h1>

          <p className="project-author-line">
            <a
              href="https://chaozhang.design/"
              target="_blank"
              rel="noreferrer"
            >
              Chao Zhang
            </a>
            <span>and</span>
            <a href="https://abedavis.com/" target="_blank" rel="noreferrer">
              Abe Davis
            </a>
            <small>Cornell University</small>
          </p>

          <div className="project-resource-links" aria-label="Project links">
            <a
              href="https://arxiv.org/abs/2608.10337"
              target="_blank"
              rel="noreferrer"
            >
              <FileText size={17} aria-hidden="true" /> Paper
            </a>
            <a
              href="https://github.com/zhangchaodesign/narrative-keyframing"
              target="_blank"
              rel="noreferrer"
            >
              <Github size={17} aria-hidden="true" /> GitHub
            </a>
            <Link href="/tool">
              <Sparkles size={17} aria-hidden="true" /> Tool
            </Link>
          </div>
        </header>

        <section className="project-preview" aria-label="Project preview">
          <PreviewVideo />
        </section>

        <section
          className="project-abstract-simple"
          aria-labelledby="abstract-title"
        >
          <h2 className="project-section-title" id="abstract-title">
            Abstract
          </h2>
          <div className="project-abstract-layout">
            <div className="project-abstract-copy">
              <p>
                We introduce <strong>narrative keyframing</strong>, an
                interaction technique for AI-assisted creative writing that lets
                writers specify different types of narrative constraints at
                selected moments in a story, then use AI to generate intervening
                prose. Inspired by the use of keyframing in animation, narrative
                keyframing offers a flexible way to connect story planning with
                adaptive control over generated text. We explore three types of
                keyframes: plot keyframes define significant events in a story,
                character keyframes represent how individual characters change
                over the narrative, and perspective keyframes capture how
                individual characters experience different events through
                first-person narratives. Plot and character keyframes offer a
                flexible way to adapt the type of high-level conditioning
                explored in previous AI writing tools to more customizable,
                iterative, and fine-scale control, while perspective keyframes
                add a new way to control characterization and focalization by
                using first-person narratives as an intermediary. Through a user
                study, we show that narrative keyframing supports a more
                controllable, transparent, and engaging way to use generative AI
                in creative writing.
              </p>
            </div>
            <div className="project-abstract-visual">
              <Image
                src="/analogy.jpg"
                alt="Comparison between animation keyframing and narrative keyframing"
                width={1524}
                height={1590}
                sizes="(max-width: 720px) calc(100vw - 60px), 370px"
              />
            </div>
          </div>
        </section>

        <section className="project-teaser-simple" aria-label="Project teaser">
          <h2 className="project-section-title" id="framework-title">
            Interaction Framework
          </h2>
          <figure>
            <div className="project-figure-frame">
              <Image
                src="/teaser.jpg"
                alt="Overview of the Narrative Keyframing workflow, showing plot, character, and perspective keyframes connected to generated prose"
                width={3072}
                height={1080}
                sizes="(max-width: 720px) calc(100vw - 60px), 876px"
              />
            </div>
            <figcaption>
              Our approach introduces <strong>narrative keyframes</strong> as
              high-level intermediate representations that connect story
              planning to narrative generation through three linked forms: plot
              keyframes, character keyframes, and perspective keyframes (Left).
              Writers define plot keyframes across events, specify character
              keyframes to capture how each character changes, and generate
              first-person perspective keyframes that can be iteratively refined
              in relation to character states (Center). During story generation,
              selected evidence from each character's perspective keyframes
              provides traceability for how characterization decisions shape the
              resulting third-person narrative (Right).
            </figcaption>
          </figure>
        </section>

        <section className="project-demo" aria-labelledby="demo-title">
          <h2 className="project-section-title" id="demo-title">
            Demo Video
          </h2>
          <div className="project-media-frame project-demo-frame">
            <iframe
              src="https://www.youtube.com/embed/QRTmqnHnT4s"
              title="Full Narrative Keyframing demo video"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        </section>

        <section className="project-citation" aria-labelledby="citation-title">
          <h2 className="project-section-title" id="citation-title">
            Citation
          </h2>
          <pre>
            <code>{citation}</code>
          </pre>
        </section>
      </article>

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
