export default function Footer() {
  return (
    <footer className="border-t border-rule mt-24">
      <div className="max-w-6xl mx-auto px-6 py-8 flex items-center justify-between text-xs text-ink-faint">
        <span>Settl.ai — built for the Razorpay AI Buildathon, Finance Controller track</span>
        <a
          href="https://github.com/nikhil-0420/Settl-ai"
          target="_blank"
          rel="noreferrer"
          className="hover:text-brass transition-colors"
        >
          View source
        </a>
      </div>
    </footer>
  );
}
