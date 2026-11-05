import { HOME } from "./homeV8Content";

// Illustrative review queue. Names and messages are invented sample data, and the section says so on the page.
const ITEMS = [
  { icon: "email", channel: "EMAIL", who: "Priya Nair · Northwind Logistics", status: "Needs review", text: "Hi Priya, saw Northwind opened a second depot in Pune. We help teams route every new enquiry to the right owner within minutes…" },
  { icon: "linkedin", channel: "LINKEDIN", who: "Daniel Reyes · Atlas Cloud Partners", status: "Needs review", text: "Congratulations on the new security lead hire. Worth comparing notes on how your team follows up on inbound interest?" },
  { icon: "whatsapp", channel: "WHATSAPP", who: "Meera Shah · Sunrise Wellness", status: "Reply drafted", text: "Thanks for getting in touch! Would Thursday at 11:00 suit for a quick call?" },
] as const;

export function ProductPreview() {
  const p = HOME.preview;
  return (
    <section className="addons product-peek" id="preview" aria-labelledby="preview-heading">
      <div className="addon-kicker">{p.kicker}</div>
      <div className="addon-intro">
        <h2 id="preview-heading">{p.title}<br /><span className="highlight">{p.accent}</span></h2>
        <p>{p.body}</p>
      </div>
      <div className="peek-window" role="img" aria-label="Sample review queue showing an email draft, a LinkedIn note and a WhatsApp reply waiting for approval">
        <div className="peek-bar" aria-hidden="true"><span /><span /><span /><b>Review queue · 3 waiting</b></div>
        <ul className="peek-list" aria-hidden="true">
          {ITEMS.map((item, i) => (
            <li key={item.channel} className={i === 0 ? "peek-open" : undefined}>
              <div className="peek-row">
                <span className="peek-chan"><svg viewBox="0 0 24 24"><use href={`#v8-icon-${item.icon}`} /></svg>{item.channel}</span>
                <span className="peek-status">{item.status}</span>
              </div>
              <strong>{item.who}</strong>
              <p>{item.text}</p>
              {i === 0 && <div className="peek-actions"><span className="peek-approve">Approve</span><span>Edit</span><span>Pause</span></div>}
            </li>
          ))}
        </ul>
      </div>
      <p className="capability-note">{p.note}</p>
    </section>
  );
}
