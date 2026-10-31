import {useRoutePoints} from "../hooks/useRoutePoints.ts";
import {useRankedRoutes} from "../hooks/useRankedRoutes.ts";
import {MapView} from "../../map/components/mapView.tsx";
import {ClickLayer} from "../../map/components/clickLayer.tsx";
import {Marker} from "react-leaflet";
import {createIcon} from "../../map/markerStyles.ts";
import {RoutesLayer} from "../components/RoutesLayer.tsx";
import {Loader} from "../../../shared/components/loader.tsx";
import {NavBar} from "../../../shared/components/navBar.tsx";
import {ROUTE_STYLES} from "../constants.ts";
import {SurveyPanel} from "../components/SurveyPanel.tsx";
import {useDevicePosition} from "../../live/hooks/useDevicePosition.ts";
import {DevicePositionMarker} from "../../live/components/devicePositionMarker.tsx";

const {panel, hint, errors, list, cardBest, card, badge, stats, statValue, resetButton,badgeMuted} = ROUTE_STYLES
export const RoutePage = () => {
    const {from, to, pick, startAt, reset} = useRoutePoints()
    const {routes, isLoading, error} = useRankedRoutes(from, to)
    const device = useDevicePosition()

    return (
        <div className='h-dvh flex flex-col'>
            <NavBar/>
            <div className='flex-1 min-h-0 flex justify-center gap-4 p-2 md:p-4'>
                <MapView>
                    <ClickLayer onPick={pick}/>
                    {from && <Marker icon={createIcon('ok')} position={[from.lat, from.lng]}/>}
                    {to && <Marker icon={createIcon('ok')} position={[to.lat, to.lng]}/>}
                    {routes && <RoutesLayer routes={routes}/>}
                    <DevicePositionMarker pos={device.pos}/>
                </MapView>

                <div className={panel}>
                    {!from && <p className={hint}>Поставте точку А на мапі</p>}
                    {from && !to && <p className={hint}>Поставте точку B на мапі</p>}
                    {isLoading && <Loader/>}
                    {error && <p className={errors}>Не вдалося побудувати маршрут</p>}
                    {routes && (
                        <ul className={list}>
                            {routes.map((route, index) => (
                                <li key={route.id} className={index === 0 ? cardBest : card}>
                                    <p className={index === 0 ? badge : badgeMuted}>
                                        {index === 0 ? 'Рекомендований' : 'Альтернатива'}
                                    </p>

                                    <p className={stats}>Дистанція<span className={statValue}>{(route.distance / 1000).toFixed(1)} км</span></p>
                                    <p className={stats}>Час<span className={statValue}>{Math.round(route.duration / 60)} хв</span></p>
                                    <p className={stats}>Штраф<span className={statValue}>{route.fine.toFixed(1)}</span></p>
                                </li>
                            ))}
                        </ul>
                    )}
                    {(from || to) && <button className={resetButton} onClick={reset}>Скинути</button>}
                    <SurveyPanel device={device} onStartHere={startAt}/>
                </div>

            </div>
        </div>
    )
}