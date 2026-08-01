'use node'

import { Agent, createTool } from '@convex-dev/agent'
import { stepCountIs } from 'ai'
import { z } from 'zod'

import { components, internal } from '../../_generated/api'
import type { Doc, Id } from '../../_generated/dataModel'
import { ProfileDataSchema } from '../../../shared/profileSchema'
import { MAX_HEADER_LINKS } from '../../../shared/resumeSchema'
import { deepStripCitations } from '../../../shared/stripCitations'
import { openai, OpenAIModels } from '../../configs/ai'

export const PROFILE_AGENT_INSTRUCTIONS = `You are a profile-building assistant. A profile is the master record of the user's career for one family of target roles — deliberately richer than any single resume. A separate tailoring agent later curates this profile into one-page resumes and cover letters per job, so more well-organized content here means better tailored documents there.

A profile holds: a role brief, contact header (name, phone, email, location, up to ${MAX_HEADER_LINKS} links), education, work experience, projects (each with an optional link — 10-15 projects is welcome), skills, extras, and voice material used to write in the user's own voice later.

How to work:
- The thread opens with a synthetic kickoff message the user never wrote. Reply with ONE short message (2-3 sentences): briefly acknowledge the role focus from the profile's roleBrief without restating it at length, and ask them to upload their current resume — plus a past cover letter if they have one — in the Documents tab, or paste the details right here, or fill in the editor beside this chat. If documents already exist, skip the ask: read them and start building instead.
- Never re-ask for the role brief when roleBrief is filled. If it is empty or too vague to tailor with, ask ONE focused question about target roles (titles, seniority, industries) and write the answer to roleBrief.
- Only ask a question when you need something specific to move the profile forward. If you need nothing from the user, end your reply without a question or a call to action.
- The user uploads files outside this chat; use listDocuments to see what has arrived and whether extraction is ready.
- When a document is ready, readDocument it and merge everything factual into the profile with updateProfile. Capture MORE than a resume would show: every project, every role, full detail. Do not trim or curate — that is the tailoring agent's job.
- Capture project repo/demo/live URLs in projects[].url (empty string when there is none). Hyperlink targets in document text appear in parentheses after the linked text.
- From a sample cover letter: store the full text in voice.sampleCoverLetter, distill voice.styleNotes (sentence rhythm, vocabulary level, register, characteristic phrasings, use of contractions), and put life/motivation details that are not resume facts into voice.personalNotes.
- Facts said in chat (new projects, context, corrections) go into the profile too — the chat is as valid a source as documents.
- NEVER invent facts. Everything in the profile must come from the user's documents or their messages. Ask when something is unclear or missing.
- updateProfile takes the FULL profile data; pass unchanged sections through as-is.
- You may use web search sparingly to verify a public detail (a company's proper name, whether a project link resolves) — never to add facts the user did not give you.
- Keep replies short and conversational. After each updateProfile, say in one or two sentences what was added or changed, then what you still need.`

export function buildProfileSystem(
  profile: Doc<'profiles'>,
  documents: Array<Doc<'documents'>>,
): string {
  const documentLines =
    documents.length > 0
      ? documents
          .map(
            (doc) =>
              `- ${doc._id} | ${doc.kind} | "${doc.title}" | ${doc.status}`,
          )
          .join('\n')
      : '(none uploaded yet)'

  return `${PROFILE_AGENT_INSTRUCTIONS}

Current profile data JSON:
${JSON.stringify(profile.data)}

Uploaded documents (id | kind | title | status):
${documentLines}`
}

const updateProfile = createTool({
  description:
    'Save the profile. Pass the FULL profile data (all sections, including unchanged ones). Facts must come from the user or their documents — never invented.',
  inputSchema: z.object({
    data: ProfileDataSchema,
  }),
  execute: async (
    ctx,
    args,
  ): Promise<{ ok: true } | { ok: false; issues: Array<string> }> => {
    if (!ctx.threadId) {
      throw new Error('updateProfile called outside a thread')
    }

    const profile = await ctx.runQuery(
      internal.modules.profile.queries.getByThreadIdInternal,
      { threadId: ctx.threadId },
    )
    if (!profile) {
      throw new Error('Profile not found for thread')
    }

    if (args.data.header.links.length > MAX_HEADER_LINKS) {
      return {
        ok: false,
        issues: [
          `header.links has ${args.data.header.links.length} entries — keep the ${MAX_HEADER_LINKS} most important ones`,
        ],
      }
    }

    await ctx.runMutation(
      internal.modules.profile.mutations.updateDataInternal,
      {
        profileId: profile._id,
        // Web-search citation markers must never reach stored profile facts.
        data: deepStripCitations(args.data),
      },
    )

    return { ok: true }
  },
})

const listDocuments = createTool({
  description:
    "List the profile's uploaded documents with their extraction status. Use this after asking the user to upload something.",
  inputSchema: z.object({}),
  execute: async (
    ctx,
  ): Promise<
    Array<{ documentId: string; kind: string; title: string; status: string }>
  > => {
    if (!ctx.threadId) {
      throw new Error('listDocuments called outside a thread')
    }

    const profile = await ctx.runQuery(
      internal.modules.profile.queries.getByThreadIdInternal,
      { threadId: ctx.threadId },
    )
    if (!profile) {
      throw new Error('Profile not found for thread')
    }

    const documents = await ctx.runQuery(
      internal.modules.profile.queries.listDocumentsInternal,
      { profileId: profile._id },
    )

    return documents.map((doc) => ({
      documentId: doc._id,
      kind: doc.kind,
      title: doc.title,
      status: doc.status,
    }))
  },
})

const readDocument = createTool({
  description:
    "Read the extracted plain text of one uploaded document. Only works once the document's status is ready.",
  inputSchema: z.object({
    documentId: z.string().describe('The document id from listDocuments'),
  }),
  execute: async (
    ctx,
    args,
  ): Promise<
    { kind: string; title: string; rawText: string } | { error: string }
  > => {
    if (!ctx.threadId) {
      throw new Error('readDocument called outside a thread')
    }

    const profile = await ctx.runQuery(
      internal.modules.profile.queries.getByThreadIdInternal,
      { threadId: ctx.threadId },
    )
    if (!profile) {
      throw new Error('Profile not found for thread')
    }

    let document: Doc<'documents'> | null
    try {
      document = await ctx.runQuery(
        internal.modules.profile.queries.getDocumentByIdInternal,
        { documentId: args.documentId as Id<'documents'> },
      )
    } catch {
      // A malformed id fails argument validation; recover instead of killing the run.
      return { error: 'Invalid document id — use an id from listDocuments' }
    }

    if (!document || document.profileId !== profile._id) {
      return { error: 'Document not found for this profile' }
    }

    if (document.status !== 'ready') {
      return {
        error: `Document is ${document.status} — text is not available yet`,
      }
    }

    return {
      kind: document.kind,
      title: document.title,
      rawText: document.rawText,
    }
  },
})

// Per-call: the OpenAI provider is initialized async by setupOpenAI().
export function createProfileAgent() {
  return new Agent(components.agent, {
    name: 'profile-agent',
    languageModel: openai.responses(OpenAIModels['gpt-5.6-luna']),
    instructions: PROFILE_AGENT_INSTRUCTIONS,
    tools: {
      updateProfile,
      listDocuments,
      readDocument,
      webSearch: openai.tools.webSearch({ searchContextSize: 'medium' }),
    },
    stopWhen: stepCountIs(15),
  })
}
