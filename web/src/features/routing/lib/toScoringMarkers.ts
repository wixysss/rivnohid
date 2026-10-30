import type {ScoringMarker} from "../types.ts";
import {SEVERITY_WEIGHT} from "./constants.ts";

type MarkerFlow = {
    lat: number
    lng: number
    severity: string
}

const isSeverity = (value: string): value is ScoringMarker['severity'] => value in SEVERITY_WEIGHT

    export const toScoringMarkers =(markers:MarkerFlow[]):ScoringMarker[] => markers.flatMap((m) => isSeverity(m.severity) ? [{ lat: m.lat, lng: m.lng, severity: m.severity }] : [])