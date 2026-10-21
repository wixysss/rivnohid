import {NavBar} from "../../../shared/components/navBar.tsx";
import {MapView} from "../components/mapView.tsx";

export const MapPage = () => {
    return (
        <div className='h-screen flex flex-col'>
            <NavBar/>
            <div className='flex-1 min-h-0 flex items-center justify-center p-4'>
                <MapView/>
            </div>
        </div>
    )
}