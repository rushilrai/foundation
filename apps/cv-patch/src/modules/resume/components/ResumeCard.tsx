import type { Doc } from '@convex/_generated/dataModel.js'
import { IconFileText } from '@tabler/icons-react'
import { Link } from '@tanstack/react-router'

import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from '@/components/ui/card'

const statusVariantMap = {
  processing: 'processing',
  generating: 'generating',
  ready: 'success',
  error: 'error',
} as const

type ResumeCardProps = {
  resume: Doc<'resumes'>
}

export const ResumeCard = ({ resume }: ResumeCardProps) => {
  return (
    <Card className="hover:border-primary/50 transition-colors">
      <CardContent className="p-4">
        <Link
          to="/dashboard/resume/$id"
          params={{ id: resume._id }}
          className="block space-y-2"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <IconFileText className="size-4 text-muted-foreground" />

              <CardTitle className="text-base">{resume.title}</CardTitle>
            </div>

            <Badge variant={statusVariantMap[resume.status as keyof typeof statusVariantMap] ?? 'secondary'}>
              {resume.status}
            </Badge>
          </div>

          <CardDescription className="line-clamp-2">
            {resume.fileName}
          </CardDescription>

          <p className="text-xs text-muted-foreground">
            {new Date(resume.createdAt).toLocaleDateString()}
          </p>
        </Link>
      </CardContent>
    </Card>
  )
}
