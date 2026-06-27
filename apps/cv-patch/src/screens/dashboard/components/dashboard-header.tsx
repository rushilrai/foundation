import { SidebarTrigger } from '@/components/ui/sidebar'

type DashboardHeaderProps = {
  title?: string
  children?: React.ReactNode
}

export const DashboardHeader = ({ title, children }: DashboardHeaderProps) => {
  return (
    <header className="flex items-center justify-between border-b px-6 py-4">
      <div className="flex items-center gap-4">
        <SidebarTrigger />

        {title && <h1 className="text-xl font-semibold">{title}</h1>}
      </div>

      {children && <div className="flex items-center gap-2">{children}</div>}
    </header>
  )
}
