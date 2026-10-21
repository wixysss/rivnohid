import {signOut} from "../../features/auth/requests.ts";
import {Link} from "react-router-dom";
import {useState} from "react";
import {MdLogout} from "react-icons/md";
import {FiUser} from "react-icons/fi";
import {useAuthStore} from "../../features/auth/store/useAuthStore.ts";

export const NavBar = () => {
    const [isOpen, setIsOpen] = useState(false)
    const [error, setError] = useState('')
    const session = useAuthStore((state) => state.session)

    const handleLogout = async () => {
        try {
            await signOut()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error')
        }
    }

    return (
        <div className='w-full flex justify-between items-center p-2'>
            <Link to='/map'><h1 className='text-[30px]'>Rivnochid</h1></Link>

            <div className='flex gap-5 items-center'>
                <Link to='/map'>Map</Link>
                <Link to='/map/editor'>Map editor</Link>

                <div className='cursor-pointer' onClick={() => setIsOpen((prev) => !prev)}><FiUser size={40}/></div>

                <div className={`user-modal modal-border ${isOpen ? 'open' : ''}`}>

                    {session ? (
                        <>
                            <button
                                className="bg-red-500 cursor-pointer w-full rounded-lg flex justify-center items-center gap-1 h-10 text-white"
                                onClick={handleLogout}>Logout <MdLogout size={20}/></button>
                            <p className='text-red-500'>{error}</p>
                        </>
                    ) : (
                        <Link to='/register'>
                            <button
                                className="bg-[#2a78d6] cursor-pointer w-full rounded-lg flex justify-center items-center gap-1 h-10 text-white"
                            >Sign in
                            </button>
                        </Link>
                    )}
                </div>
            </div>
        </div>
    )
}