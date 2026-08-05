import { NextResponse } from 'next/server'
import { apiHandler } from '@/lib/apiHandler'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// ─── DB Row Interfaces ───────────────────────────────────────────────────────

interface ProjectRow {
  id: string
  name: string
}

interface ParcelRow {
  id: string
  parcel_number: string
  lr_number_proposed: string | null
  area_ha: number | null
  parcel_status: string
  block_number: string
  traverse_id: string | null
  traverse_status: string | null
  accuracy_order: string | null
  computed_area_ha: number | null
  has_closed_traverse: boolean | null
}

interface SchemeRow {
  scheme_number: string | null
  county: string | null
  adjudication_section: string | null
  status: string | null
}

export const GET = apiHandler({ auth: true, rateLimit: { max: 60, windowMs: 60000 } }, async (request, ctx) => {
  const projectId = request.nextUrl.searchParams.get('project_id')

  if (!projectId) {
    return NextResponse.json({ error: 'project_id is required' }, { status: 400 })
  }

  // Verify ownership
  const { rows: projects } = await db.query<ProjectRow>(
    'SELECT id, name FROM projects WHERE id = $1 AND user_id = $2',
    [projectId, ctx.userId]
  )
  if (projects.length === 0) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  // Get all parcels with their traverse status
  const { rows: parcels } = await db.query<ParcelRow>(
    `SELECT 
      p.id, p.parcel_number, p.lr_number_proposed, p.area_ha, p.status as parcel_status,
      b.block_number,
      pt.id as traverse_id, pt.status as traverse_status, 
      pt.accuracy_order, pt.computed_area_ha,
      COALESCE(pt.is_closed, false) as has_closed_traverse
     FROM parcels p
     JOIN blocks b ON b.id = p.block_id
     LEFT JOIN parcel_traverses pt ON pt.parcel_id = p.id AND pt.status IN ('computed', 'approved')
     WHERE b.project_id = $1
     ORDER BY b.block_number, p.parcel_number`,
    [projectId]
  )

  // Evaluate readiness per parcel
  const parcelChecks = parcels.map((p) => {
    const checks: Record<string, { pass: boolean; label: string; detail: string }> = {
      traverse_computed: {
        pass: p.traverse_id !== null,
        label: 'Traverse Computed',
        detail: p.traverse_id ? 'Bowditch adjustment complete' : 'No traverse computation found',
      },
      traverse_closed: {
        pass: p.has_closed_traverse === true,
        label: 'Traverse Closed',
        detail: p.has_closed_traverse ? 'Closing error within tolerance' : 'Traverse not closed or not computed',
      },
      accuracy_acceptable: {
        pass: p.accuracy_order != null && ['1st order', '2nd order', '3rd order'].includes(p.accuracy_order),
        label: 'Accuracy Order',
        detail: p.accuracy_order ? `${p.accuracy_order} — ${p.accuracy_order === '3rd order' ? 'Minimum for cadastral' : 'Acceptable'}` : 'Not computed',
      },
      area_computed: {
        pass: p.computed_area_ha !== null && p.computed_area_ha > 0,
        label: 'Area Computed',
        detail: p.computed_area_ha ? `${Number(p.computed_area_ha).toFixed(4)} ha` : 'Area not available',
      },
      deed_plan_ready: {
        pass: p.traverse_status === 'computed' || p.traverse_status === 'approved',
        label: 'Deed Plan Generatable',
        detail: (p.traverse_status === 'computed' || p.traverse_status === 'approved') ? 'Can generate deed plan PDF' : 'Requires computed traverse',
      },
    }

    const allPass = Object.values(checks).every(c => c.pass)
    const passCount = Object.values(checks).filter(c => c.pass).length

    return {
      parcel_id: p.id,
      parcel_number: p.parcel_number,
      lr_number: p.lr_number_proposed,
      block_number: p.block_number,
      area_ha: p.area_ha,
      parcel_status: p.parcel_status,
      checks,
      ready: allPass,
      passCount,
      totalChecks: Object.keys(checks).length,
    }
  })

  // Overall readiness
  const totalParcels = parcelChecks.length
  const readyParcels = parcelChecks.filter(p => p.ready).length
  const overallReady = totalParcels > 0 && readyParcels === totalParcels

  // Check scheme-level requirements
  const { rows: schemeRows } = await db.query<SchemeRow>(
    'SELECT scheme_number, county, adjudication_section, status FROM scheme_details WHERE project_id = $1',
    [projectId]
  )
  const scheme = schemeRows[0]

  const schemeChecks: Record<string, { pass: boolean; label: string; detail: string }> = {
    scheme_metadata: {
      pass: !!(scheme?.scheme_number && scheme?.county && scheme?.adjudication_section),
      label: 'Scheme Metadata Complete',
      detail: scheme?.scheme_number ? `Scheme #${scheme.scheme_number}, ${scheme.county}` : 'Missing scheme number, county, or adjudication section',
    },
    all_parcels_ready: {
      pass: overallReady,
      label: `All Parcels Ready (${readyParcels}/${totalParcels})`,
      detail: readyParcels === totalParcels ? 'All parcels pass readiness checks' : `${totalParcels - readyParcels} parcels need attention`,
    },
  }

  const schemeReady = Object.values(schemeChecks).every(c => c.pass)

  return NextResponse.json({
    data: {
      project_id: projectId,
      project_name: projects[0].name,
      scheme,
      overall_ready: schemeReady,
      parcels_ready: readyParcels,
      parcels_total: totalParcels,
      scheme_checks: schemeChecks,
      parcel_checks: parcelChecks,
    }
  })
})
