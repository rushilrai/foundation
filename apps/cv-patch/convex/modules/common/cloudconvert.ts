'use node'

import CloudConvert from 'cloudconvert'

import type { Id } from '../../_generated/dataModel'
import type { ActionCtx } from '../../_generated/server'

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

export async function convertFileToPdf(
  ctx: ActionCtx,
  fileId: Id<'_storage'>,
  fileName: string,
): Promise<Id<'_storage'>> {
  const cc = getClient()

  const fileBlob = await ctx.storage.get(fileId)
  if (!fileBlob) {
    throw new Error(`File not found in storage: ${fileId}`)
  }
  const fileBytes = new Uint8Array(await fileBlob.arrayBuffer())

  const job = await cc.jobs.create({
    tasks: {
      'import-file': {
        operation: 'import/upload',
      },
      'convert-to-pdf': {
        operation: 'convert',
        input: ['import-file'],
        output_format: 'pdf',
      },
      'export-pdf': {
        operation: 'export/url',
        input: ['convert-to-pdf'],
      },
    },
  })

  const importTask = job.tasks.find((t) => t.name === 'import-file')
  if (!importTask) {
    throw new Error('CloudConvert: import task not found in job')
  }

  await cc.tasks.upload(importTask, fileBytes, fileName)

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
