import {NavBar} from "../../../shared/components/navBar.tsx";
import {MapView} from "../components/mapView.tsx";
import {useDevicePosition} from "../../live/hooks/useDevicePosition.ts";
import {DevicePositionMarker} from "../../live/components/devicePositionMarker.tsx";

export const MapPage = () => {
    const device = useDevicePosition()
    return (
        <div className='h-screen flex flex-col'>
            <NavBar/>
            <div className='flex-1 min-h-0 flex items-center justify-center p-4'>
                <MapView>
                    <DevicePositionMarker pos={device.pos}/>
                </MapView>
            </div>
        </div>
    )
}
