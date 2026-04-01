import { Alert, AlertDescription } from '@/components/ui/alert' // shadcn/ui

export function DWGImportGuidance() {
  return (
    <Alert className="border-amber-500/30 bg-amber-500/10">
      <div className="text-amber-400 font-semibold text-sm mb-1">DWG files cannot be opened directly</div>
      <AlertDescription className="text-xs text-zinc-400">
        DWG is Autodesk&apos;s proprietary format. Convert to DXF first — it&apos;s free and takes 10 seconds:
        <ol className="mt-2 space-y-1 list-decimal list-inside text-xs">
          <li>Open your DWG in AutoCAD, Civil 3D, or <a href="https://www.librecad.org" className="underline hover:text-amber-400">LibreCAD (free)</a></li>
          <li>File → Save As → DXF 2018 format</li>
          <li>Upload the .dxf file here</li>
        </ol>
      </AlertDescription>
    </Alert>
  )
}

