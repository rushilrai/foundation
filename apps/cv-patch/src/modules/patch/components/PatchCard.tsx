import { Link } from '@tanstack/react-router'
import type { Doc } from '@convex/_generated/dataModel.js'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardTitle,
} from '@/components/ui/card'

const statusVariantMap = {
  processing: 'processing',
  generating: 'generating',
  ready: 'success',
  error: 'error',
} as const

type PatchCardProps = {
  patch: Doc<'patches'>
}

export const PatchCard = ({ patch }: PatchCardProps) => {
  return (
    <Card className="hover:border-primary/50 transition-colors">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base truncate">{patch.title}</CardTitle>
          <Badge
            variant={
              statusVariantMap[patch.status as keyof typeof statusVariantMap] ??
              'secondary'
            }
          >
            {patch.status}
          </Badge>
        </div>

        <CardDescription className="line-clamp-2">
          {patch.companyName && `${patch.companyName} • `}
          {patch.roleName || 'No role specified'}
        </CardDescription>

        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {new Date(patch.createdAt).toLocaleDateString()}
          </p>
        </div>
      </CardContent>

      <CardFooter>
        <Button
          variant="default"
          size="sm"
          className="w-full"
          render={
            <Link
              to="/dashboard/resume/$id/patch/$patchId"
              params={{ id: patch.resumeId, patchId: patch._id }}
            >
              View
            </Link>
          }
        ></Button>
      </CardFooter>
    </Card>
  )
}
