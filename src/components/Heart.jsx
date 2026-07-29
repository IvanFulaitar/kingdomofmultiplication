export default function Heart({ filled }) {
  return <span className="text-xl">{filled ? "❤️" : "🖤"}</span>;
}
