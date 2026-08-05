import { api } from "../../lib/api";
import { AiCard } from "../../components/AiCard";
import { AsyncSection } from "../../components/AsyncSection";
import { StatusBadge } from "../../components/StatusBadge";
import { SuggestedPosts } from "../../components/SuggestedPosts";
import { useApi, useCachedApi } from "../../hooks/useApi";
import { CACHE_KEYS } from "../../lib/cacheKeys";
import { Ico } from "../../components/Ico";
import { RankedList } from "./RankedList";

export function CustomerTab({ onGenerate }: { onGenerate: (title: string, context: string) => void }) {
  const questions = useApi(api.customerQuestions);
  const insights = useCachedApi(CACHE_KEYS.customerInsights, api.customerInsights);
  const chats = useApi(api.zohoChats);
  // `insights` loading/error is surfaced once, in the Service Analysis card;
  // the lower block gates on data and renders nothing until it arrives.
  const ins = insights.data;

  return (
    <>
      <div className="rs-banner" style={{ marginBottom: 16 }}>
        <div className="rs-banner-ico"><Ico k="sparkle" /></div>
        <div className="rs-banner-txt">
          <b>About this data</b> <StatusBadge kind="data" source="zoho" /><br />
          Analysed from UrbanSpace's customer chats linked via ZOHO CRM.
          {chats.data ? ` Based on ${chats.data.count} customer chats.` : ""} Data refreshes weekly.
        </div>
      </div>
      <div className="soc-grid" style={{ marginBottom: 16 }}>
        <div className="gold-card">
          <div className="ct-title-row">
            <span className="ct-title-ico"><Ico k="question" /></span>
            <div>
              <div className="ct-title" style={{ color: "#4A3200" }}>Common questions before booking <StatusBadge kind="data" source="zoho" /></div>
              <div className="ct-sub" style={{ color: "#7A5A16", marginBottom: 0 }}>Questions customers ask in chats</div>
            </div>
          </div>
          <AsyncSection q={questions}>
            {(q) => q.questions.length === 0
              ? <div className="empty-note">No questions detected yet.</div>
              : <div className="q-scroll">{q.questions.map((question, i) => (
                  <div className="q-row" key={i}><span className="q-num">{i + 1}.</span> {question}</div>
                ))}</div>}
          </AsyncSection>
        </div>
        <div className="gold-card-dk">
          <div className="ct-title-row">
            <span className="ct-title-ico" style={{ color: "#fff" }}><Ico k="service" /></span>
            <div>
              <div className="ct-title" style={{ color: "#fff" }}>Service Analysis <StatusBadge kind="ai" light /></div>
              <div className="ct-sub" style={{ color: "#FFE9C2", marginBottom: 0 }}>Top services requested, ranked by demand</div>
            </div>
          </div>
          <AsyncSection q={insights}>
            {(ins) => ins.insights.top_services.length === 0
              ? <div className="empty-note">No service data yet.</div>
              : <RankedList items={ins.insights.top_services} light />}
          </AsyncSection>
        </div>
      </div>
      {ins && (
        <>
          <AiCard title="AI Insights & Patterns" sub="Recurring themes found in customer chats" tag="AI PATTERNS">
            <div className="insight-row" style={{ borderTop: "1px solid #F6E3DD" }}>
              <div style={{ flex: 1 }}>
                <div className="insight-title">Summary</div>
                <div className="insight-body">{ins.insights.summary}</div>
              </div>
            </div>
            {ins.insights.top_features.length > 0 && (
              <div className="insight-row" style={{ borderTop: "1px solid #F6E3DD" }}>
                <div style={{ flex: 1 }}>
                  <div className="insight-title">Most-requested features</div>
                  <div className="insight-body">{ins.insights.top_features.join(" · ")}</div>
                </div>
              </div>
            )}
            {ins.insights.top_promotions.length > 0 && (
              <div className="insight-row" style={{ borderTop: "1px solid #F6E3DD" }}>
                <div style={{ flex: 1 }}>
                  <div className="insight-title">Promotions customers ask about</div>
                  <div className="insight-body">{ins.insights.top_promotions.join(" · ")}</div>
                </div>
              </div>
            )}
          </AiCard>
          <div style={{ height: 16 }} />
          <SuggestedPosts title="AI Suggested Posts" sub="Post ideas generated from customer chat patterns"
            titles={ins.titles} subLabel="From customer chat analysis"
            onGenerate={(title) => onGenerate(title, ins.prefill_prompt)} />
        </>
      )}
    </>
  );
}
