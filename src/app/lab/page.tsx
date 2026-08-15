import CoaLookup from "./CoaLookup";

export default function LabTestingPage() {
  return (
    <main className="site-main">
      <div style={{ paddingTop: 36 }}>
        <div className="lab-hero">
          <div>
            <h2>Independent Testing, Every Batch</h2>
            <p>
              Every lot that reaches our warehouse is sampled and sent to an independent
              third-party laboratory before it&apos;s released for sale. We verify identity,
              purity, and endotoxin levels — and we publish the results.
            </p>
          </div>
          <CoaLookup />
        </div>

        <div className="section-head">
          <div>
            <h2>How Our Testing Process Works</h2>
          </div>
        </div>
        <div className="step-grid" style={{ marginBottom: 60 }}>
          <div className="step-card">
            <div className="num">1</div>
            <h4>Incoming Sample</h4>
            <p>A sample from every incoming lot is pulled before inventory is released for sale.</p>
          </div>
          <div className="step-card">
            <div className="num">2</div>
            <h4>Independent Lab Analysis</h4>
            <p>
              Samples are sent to a third-party laboratory for HPLC purity testing, mass-spec
              identity confirmation, and endotoxin screening.
            </p>
          </div>
          <div className="step-card">
            <div className="num">3</div>
            <h4>COA Published</h4>
            <p>Results are logged against the lot number and made available for lookup here — no request required.</p>
          </div>
        </div>
      </div>
    </main>
  );
}
