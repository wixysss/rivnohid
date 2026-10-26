import L from "leaflet";
import {Marker, Popup} from "react-leaflet";
import {formatDuration} from "../requests.ts";
import {useVoiceNotes} from "../hooks/useVoiceNotes.ts";
import {VoicePlayer} from "./voicePlayer.tsx";

const micIcon = L.divIcon({
    html: `<div class="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-[#2a78d6] text-white shadow">
             <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z"/></svg>
           </div>`,
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
})

// Голосові нотатки з пристрою на карті (лише ті, що мають координати)
export const VoiceNoteLayer = () => {
    const {data} = useVoiceNotes()
    return (
        <>
            {data?.filter((n) => n.lat != null && n.lng != null).map((n) => (
                <Marker key={n.id} position={[n.lat!, n.lng!]} icon={micIcon}>
                    <Popup>
                        <div className='flex flex-col items-center gap-1'>
                            <h3 className='font-medium'>Голосова нотатка</h3>
                            <span className='text-xs text-zinc-500'>
                                {new Date(n.created_at).toLocaleString('uk-UA')} · {formatDuration(n.duration_ms)}
                            </span>
                            <VoicePlayer id={n.id}/>
                        </div>
                    </Popup>
                </Marker>
            ))}
        </>
    )
}
