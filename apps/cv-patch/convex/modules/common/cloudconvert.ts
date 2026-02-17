'use node'

import CloudConvert from 'cloudconvert'

import type { ActionCtx } from 'convex/_generated/server'
import type { Id } from 'convex/_generated/dataModel'

let client: CloudConvert | null = null

function getClient(): CloudConvert {
  if (client) return client

  const apiKey = process.env.CLOUDCONVERT_API_KEY
  if (!apiKey) {
    throw new Error('CLOUDCONVERT_API_KEY environment variable is not set')
  }

  client = new CloudConvert(apiKey)
  return client
}

export async function convertDocxToPdf(
  ctx: ActionCtx,
  docxFileId: Id<'_storage'>,
): Promise<Id<'_storage'>> {
  const cc = getClient()

  const docxBlob = await ctx.storage.get(docxFileId)
  if (!docxBlob) {
    throw new Error(`File not found in storage: ${docxFileId}`)
  }
  const docxBytes = new Uint8Array(await docxBlob.arrayBuffer())

  const job = await cc.jobs.create({
    tasks: {
      'import-docx': {
        operation: 'import/upload',
      },
      'convert-to-pdf': {
        operation: 'convert',
        input: ['import-docx'],
        output_format: 'pdf',
      },
      'export-pdf': {
        operation: 'export/url',
        input: ['convert-to-pdf'],
      },
    },
  })

  const importTask = job.tasks.find((t) => t.name === 'import-docx')
  if (!importTask) {
    throw new Error('CloudConvert: import task not found in job')
  }

  await cc.tasks.upload(importTask, docxBytes, 'resume.docx')

  const completedJob = await cc.jobs.wait(job.id)

  const exportUrls = cc.jobs.getExportUrls(completedJob)
  if (!exportUrls.length || !exportUrls[0].url) {
    throw new Error('CloudConvert: no export URL in completed job')
  }

  const pdfResponse = await fetch(exportUrls[0].url)
  if (!pdfResponse.ok) {
    throw new Error(
      `Failed to download PDF from CloudConvert: ${pdfResponse.status}`,
    )
  }
  const pdfArrayBuffer = await pdfResponse.arrayBuffer()

  const pdfFileId = await ctx.storage.store(
    new Blob([pdfArrayBuffer], { type: 'application/pdf' }),
  )

  return pdfFileId
}
