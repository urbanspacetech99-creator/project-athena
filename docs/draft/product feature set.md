# Marketing Agent & Dashboard: Feature Specification

## 1. Overview

### 1.1 Purpose

The Marketing Agent & Dashboard is a web application for the marketing team. It does two things: it shows how the team's published content is performing, and it helps the team decide what to post next and draft those posts.

### 1.2 Product structure

The product has three areas:

- **Home:** an at-a-glance view of performance over the past week.
- **Research:** four sources of audience and market insight, each of which proposes content ideas.
- **Generate:** a guided tool that turns an idea into ready-to-publish post drafts, including imagery.

The three areas are linked. Each research source suggests five post titles; the user picks one, and it pre-fills the Generate tab, so research feeds directly into drafting.

### 1.3 Scope of this project

The ten features in Section 3 are what this project will deliver. A few boundaries are fixed by design to keep delivery focused:

- Reporting windows are set, not chosen by the user: weekly for performance and trends, monthly for customer insights.
- The trend keywords and competitor list are managed within the product, not edited by users.
- All data comes through authorized APIs only (see Section 2).

### 1.4 Wishlist (out of scope)

During discussion, additional ideas were raised. They are recorded here as recommendations for later and are not part of this project:

- User-configurable date ranges or reporting windows.
- User management of the trend keyword and competitor lists.
- Direct publishing or scheduling of posts to social platforms.
- Social and review sources beyond Facebook, Instagram, and Google reviews.
- Analytics on content other than the team's own posts, with competitor analysis being the one in-scope exception.

---

## 2. Data sources and compliance

This section sets the rules for how the product gets and uses data. They apply to every feature.

### 2.1 Authorized sources only

All data comes through official, authorized APIs. Examples include Google APIs for search trends and reviews, and the Meta APIs for Facebook and Instagram content. The product does no web scraping of any website.

### 2.2 Competitor data handling

Competitor insight comes only from public content returned by authorized APIs: the text of competitors' posts and the comments on those posts. The product does not scrape competitor websites, for legal and compliance reasons.

### 2.3 AI use and model training

The product uses AI to analyse and summarise data when a user asks for it. It does not train or fine-tune any AI model on retrieved data, whether competitor, customer, social, or the team's own content. This keeps the product's AI use to analysis at the time of the request and avoids copyright and legal risk.

### 2.4 Customer data privacy

Customer chat history comes through authorized Zoho access and is used only to produce aggregate insight. It is handled in line with the organisation's privacy obligations and is not used for anything beyond the insights described here.

---

## 3. Feature summary

| # | Feature | Area | Uses AI | One-line description |
|---|---------|------|:-------:|----------------------|
| 1 | Weekly KPI Snapshot | Home | No | Headline performance numbers for the past week. |
| 2 | Weekly Engagement Summary | Home | Partial | Top-performing post plus an AI reading of comment themes. |
| 3 | Internet Trends Research | Research | Yes | Search interest in self-storage keywords, with suggested titles. |
| 4 | Customer Question Extraction | Research | No | Customer questions pulled from Zoho chat history. |
| 5 | Customer Insights Summary | Research | Yes | Monthly AI summary of what customers are asking for. |
| 6 | Social Comments & Reviews | Research | Yes | Audience demand from social comments and Google reviews. |
| 7 | Competitor Analysis | Research | Yes | What competitors post and how audiences respond. |
| 8 | Post Generator | Generate | Yes | Produces three draft posts with captions and AI imagery. |
| 9 | Saved Drafts | Generate | No | A holding area for drafts to keep and refine. |
| 10 | Aggregated AI Recommendations | Generate | Yes | Content ideas drawn from all research sources combined. |

---

## 4. Feature detail

### 4.1 Home

#### 4.1.1 Weekly KPI Snapshot

A single-glance summary of the team's content performance over the past week, shown as four numbers: views, likes, interactions, and posts published. It gives the team a quick read on the week before they do anything else. The window is the past week and is fixed.

#### 4.1.2 Weekly Engagement Summary

A short written companion to the KPI numbers, in two parts shown together:

- **Top post (no AI):** which of the team's posts drove the most engagement this week.
- **Comment insights (AI):** an AI summary of engagement on the team's own posts that reads the comments for themes, sentiment, and recurring feedback.

Together they answer what worked and what the audience is saying about it. Scope is limited to the team's own posts.

### 4.2 Research

#### 4.2.1 Research-to-Generate handoff (shared behaviour)

Each of the four research sources shows its findings and then offers five AI-suggested post titles. The user selects one, and it pre-fills the prompt in the Generate tab. This handoff applies to all four research features (4.2.2 to 4.2.6) and to the aggregated recommendations (4.3.3).

#### 4.2.2 Internet Trends Research

This source tracks public search interest in a fixed set of self-storage keywords, reported as searches per week. The keyword list is defined within the product. From this data it suggests five post titles that match current search interest, so the team can act on rising trends.

#### 4.2.3 Customer Question Extraction

This source pulls aggregate customer chat history from Zoho and extracts the questions customers have asked, meaning messages phrased as questions in the conversation history. It surfaces, in customers' own words, what they are unsure about or actively looking for. It uses no AI. It is separate from the Customer Insights Summary (4.2.4), which interprets the same source.

#### 4.2.4 Customer Insights Summary

A monthly AI summary of the full Zoho customer chat history. It identifies the top requested services, features, and promotions across all conversations. Where 4.2.3 surfaces raw questions, this feature reads the body of conversations to find recurring demand, then suggests five post titles. The window is monthly and is fixed.

#### 4.2.5 Social Comments & Reviews

This source draws audience signal from the team's Facebook and Instagram presence and from Google reviews:

- **Views:** combined views per post for the week across Facebook and Instagram.
- **Comments:** all comments on those posts, read to find the services and topics viewers ask about.
- **Reviews:** an AI aggregation of Google reviews.

From this it suggests five post titles. Scope is limited to the three sources named above.

#### 4.2.6 Competitor Analysis

This source summarises what a defined list of competitors is publishing and how their audiences respond. It draws only on the public post text and comments returned by authorized APIs (see Section 2.2). The competitor list is fixed within the product. From this it suggests five post titles, which help the team respond to competitor activity and find gaps.

### 4.3 Generate

#### 4.3.1 Post Generator

The main content-creation tool. The user shapes a post through a set of choices, then generates three complete drafts to choose from.

Inputs:

- **Platform:** Instagram (shorter, hashtag-led captions) or Facebook (longer captions).
- **Prompt:** a freeform text field, typed directly or pre-filled from any research source.
- **Tone:** Friendly, Professional, Urgent, or Funny.
- **Length:** Short, Medium, or Long.
- **Visual style:** Before/after, Clean product, Lifestyle, or Text-forward.
- **Include in post:** any combination of hashtags, image, call to action, emoji, and pricing info.

Output: three post options. Each has a caption and a generated AI image in the chosen visual style. For each option the user can save it or edit the image in Canva to refine the visual before publishing.

#### 4.3.2 Saved Drafts

A section that holds the drafts the user has saved, where the text of a draft can be edited. It gives the team a place to keep and refine content before publishing.

#### 4.3.3 Aggregated AI Recommendations

This feature draws on all research sources combined: internet trends, customer insights, social comments and reviews, and competitor activity. From them it suggests five post titles, and selecting one pre-fills the Generate prompt, as with the individual sources. It differs from the per-source suggestions (4.2.2 to 4.2.6) in that it works across every source at once rather than one at a time.
