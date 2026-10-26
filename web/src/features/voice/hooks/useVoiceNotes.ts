import {useQuery} from "@tanstack/react-query";
import {getVoiceNotes} from "../requests.ts";

export const useVoiceNotes = () => useQuery({queryKey: ['voice-notes'], queryFn: getVoiceNotes, refetchInterval: 30000})
