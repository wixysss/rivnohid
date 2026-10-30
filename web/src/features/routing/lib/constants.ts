import type {MarkerValues} from "../../map/schemas.ts";

export const RADIUS_M = 40
export const SEVERITY_WEIGHT: Record<MarkerValues['severity'], number> = {
    bad: 10,
    warning: 3,
    ok: 0
}