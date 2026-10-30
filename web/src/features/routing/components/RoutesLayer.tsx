import type {ScoredRoute} from "../types.ts";
import {Polyline} from "react-leaflet";
import {BEST_ROUTE_STYLE, OTHER_ROUTE_STYLE} from "../constants.ts";

type Props = { routes: ScoredRoute[] }

export const RoutesLayer = ({routes}: Props) => {
    return(
            <>
                {[...routes].reverse().map((route) => (
                    <Polyline
                        key={route.id}
                        positions={route.path}
                        pathOptions={route.id === routes[0].id ? BEST_ROUTE_STYLE : OTHER_ROUTE_STYLE}
                    />
                ))}
            </>
        )
}