import { PageGuide, PageHeader, Panel, SectionHead } from "@/components/ui";
import { getCommunityDataset } from "@/lib/data";
import register from "@/data/report-register.json";
import { spatialCatalogue } from "@/lib/spatial";
import { SystemStatus } from "@/components/system-status";
export default async function Page() {
  const { records: rows, status } = await getCommunityDataset();
  return (
    <>
      <PageHeader
        eyebrow="Data"
        title="Data"
        description="See the field, map and external datasets used across Blue Lagos."
      />
      <PageGuide
        shows="Every dataset behind the platform: what it is, where it came from, how current it is, and what it is used for."
        read="The first table is a plain status board — what is working, what is only partly working, and what is not available at all. The catalogue below gives the record counts, sources and limitations for each dataset."
        look={[
          "Which datasets are field-collected and which come from elsewhere",
          "What is listed as not available, and why",
          "The licence and processing note attached to every spatial source",
        ]}
      />

      <SectionHead
        title="What is working right now"
        description="Including the parts that are not. Nothing is hidden behind a reassuring label."
      />
      <Panel title="" subtitle="">
        <SystemStatus />
      </Panel>

      <SectionHead
        title="The datasets themselves"
        description="Record counts, sources, coverage and known limitations. Credentials and internal configuration are deliberately excluded."
      />
      <Panel
        title=""
        subtitle=""
      >
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Dataset</th>
                <th scope="col">Status</th>
                <th scope="col">What it is</th>
                <th scope="col" className="num">Records</th>
                <th scope="col">Where it comes from</th>
                <th scope="col">How current</th>
                <th scope="col">What to keep in mind</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <strong>Blue Lagos community baseline</strong>
                </td>
                <td>
                  <span className="badge positive">Live</span>
                </td>
                <td>Community records with locations</td>
                <td className="num">{rows.length}</td>
                <td>Blue Lagos field survey</td>
                <td>Read fresh on every page load</td>
                <td>{status.geolocatedCount} have coordinates; {status.validationIssueCount} notes raised; the database reports {status.serverCount ?? "no total to check against"}</td>
              </tr>
              <tr>
                <td>
                  <strong>Baseline cluster register</strong>
                </td>
                <td>
                  <span className="badge positive">In use</span>
                </td>
                <td>Cluster names for each community</td>
                <td className="num">{register.length}</td>
                <td>Baseline report, Appendix A.7</td>
                <td>Fixed at the baseline report</td>
                <td>Matched to communities by name and local government</td>
              </tr>
              {spatialCatalogue().slice(1).map((layer) => (
                <tr key={layer.id}>
                  <td>
                    <strong>{layer.title}</strong>
                  </td>
                  <td><span className={layer.status === "integrated" ? "badge positive" : "badge warning"}>{layer.status === "integrated" ? "In use" : layer.status}</span></td>
                  <td>{layer.type}</td>
                  <td className="num">{layer.records}</td>
                  <td>{layer.provider}</td>
                  <td>{layer.date}</td>
                  <td>{layer.limitation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <div className="callout section-gap">
        The mapped communities are also available as GeoJSON from <code>/api/communities</code>, and
        the optional map layers from <code>/api/layers/&lt;name&gt;</code>. If the geometry grows
        substantially, these should move to vector tiles rather than whole-file GeoJSON.
      </div>

      <SectionHead
        title="Licensing and processing"
        description="Every spatial source, how it was processed, and the licence it carries."
      />
      <Panel title="" subtitle="">
        <div className="table-wrap"><table className="data-table"><thead><tr><th scope="col">Layer</th><th scope="col">Licence</th><th scope="col">How it was processed</th><th scope="col">Source</th></tr></thead><tbody>
          {spatialCatalogue().map((layer) => <tr key={layer.id}><td>{layer.title}</td><td>{layer.license}</td><td>{layer.processing}</td><td>{layer.source}</td></tr>)}
        </tbody></table></div>
      </Panel>
    </>
  );
}
