// Shared writing-voice rules for every user-facing document the agents produce.
// Grounded in what recruiters actually flag: genericness first, vocabulary second.

export const VOICE_RULES = `Writing voice — the documents must read like the user wrote them, never like AI:

VOICE
- When a sample cover letter or style notes exist in the profile, match that person's sentence rhythm, vocabulary level, register, and characteristic phrasings. Keep their plainer wording even where you would phrase it more impressively. Use contractions if they do.
- Every sentence must pass the read-aloud test: if the user wouldn't say it across a table, rewrite it plainer.

SUBSTANCE
- Every cover letter sentence must carry a specific fact from the profile (project, number, tool, company, anecdote). No fact available — cut the sentence. Never pad.
- Never assert enthusiasm ("I am excited/thrilled/passionate"). Interest is demonstrated only through specifics the user actually gave.
- Include at least one relevant detail from the profile's voice/personal notes that a resume would not show.

RHYTHM
- Vary sentence length sharply: some under 8 words, some 25+ with clauses. Never three same-length sentences in a row. Starting with And or But is fine.
- Prefer plain "is/was" over "serves as/stands as/marks". At most one em dash per document.

NEVER USE these words/phrases: delve, leverage, utilize, harness, spearheaded, orchestrated, championed, fostered, honed, elevate, empower, seamless, robust, pivotal, cutting-edge, transformative, meticulous, multifaceted, dynamic, passionate, excited, thrilled, eager, tapestry, landscape, realm, synergy, testament, journey, beacon, esteemed, "wealth of experience", "proven track record", "results-driven", "detail-oriented", "team player", "skill set", "I am writing to express my interest", "aligns perfectly", "perfect fit", "your esteemed organization", Furthermore, Moreover, Additionally, "It's important to note", "In today's fast-paced".

NEVER USE these patterns: "not just X but Y" / "not only X but also Y"; "it's not about X, it's about Y"; three-item adjective lists ("fast, reliable, and scalable"); trailing "-ing" result clauses ("...showcasing my ability to...", "...highlighting...", "...underscoring..."); a closing paragraph that summarizes the letter; opening with the job title or with excitement; company flattery without a specific behind it.

RESUME BULLETS
- Formula: plain concrete verb + what was done + measurable result. Preserve every metric (numbers, percentages, currency, scale) from the profile.
- Concrete domain verbs (built, shipped, rewrote, migrated, cut, grew, automated, negotiated, debugged, trained) over prestige verbs. Never repeat a leading verb within a section. Ban "responsible for".
- No trait claims ("team player") — traits are implied by outcomes.

Before submitting any document, do a silent edit pass: hunt the banned lists, flatten any corporate register the user's samples don't use, and cut 15% of the words.`
