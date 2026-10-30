import {signOut} from "../../features/auth/requests.ts";
import {Link} from "react-router-dom";
import {useState} from "react";
import {MdLogout} from "react-icons/md";
import {FiUser} from "react-icons/fi";
import {useAuthStore} from "../../features/auth/store/useAuthStore.ts";
import logo from '../../../public/logo.png'
import {NAV_LINKS, NAV_STYLES} from "../constants.ts";

const {
    overlay,
    desktopLinks,
    item,
    itemClosed,
    itemOpen,
    danger,
    overlayClosed,
    overlayOpen,
    burger,
    line,
    lineTopOpen,
    lineBotOpen,
    lineMidOpen
} = NAV_STYLES
export const NavBar = () => {
    const [isOpen, setIsOpen] = useState(false)
    const [error, setError] = useState('')
    const [isMenuOpen, setIsMenuOpen] = useState(false)

    const session = useAuthStore((state) => state.session)

    const handleLogout = async () => {
        try {
            await signOut()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error')
        }
    }

    return (
        <header className='relative z-1200 flex w-full items-center justify-between p-2'>
            <Link className='relative z-20 flex items-center gap-1' to='/map'><img alt='rivnohid'
                                                                                   className='w-15 h-auto' src={logo}/>
                <h1 className='text-[30px]'>Rivnohid</h1></Link>
            <nav className={desktopLinks}>

                {NAV_LINKS.map((link) => (
                    <Link key={link.to} to={link.to} className={link?.danger ? 'text-red-500' : ''}>
                        {link.label}
                    </Link>
                ))}
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
            </nav>


            <button
                className={burger}
                aria-label={isMenuOpen ? 'Закрити меню' : 'Відкрити меню'}
                aria-expanded={isMenuOpen}
                onClick={() => setIsMenuOpen((prev) => !prev)}
            >
                <span className={`${line} ${isMenuOpen ? lineTopOpen : ''}`}/>
                <span className={`${line} ${isMenuOpen ? lineMidOpen : ''}`}/>
                <span className={`${line} ${isMenuOpen ? lineBotOpen : ''}`}/>
            </button>

            <div className={`${overlay} ${isMenuOpen ? overlayOpen : overlayClosed}`}>
                {NAV_LINKS.map((link, index) => (
                    <Link
                        key={link.to}
                        to={link.to}
                        onClick={() => setIsMenuOpen(false)}
                        className={`${item} ${isMenuOpen ? itemOpen : itemClosed} ${link?.danger ? danger : ''}`}
                        style={{transitionDelay: isMenuOpen ? `${index * 60}ms` : '0ms'}}
                    >
                        {link.label}
                    </Link>
                ))}
                {session ? (
                    <>
                        <button
                            className="bg-red-500 cursor-pointer w-25 rounded-lg flex justify-center items-center gap-1 h-10 text-white"
                            onClick={handleLogout}>Logout <MdLogout size={20}/></button>
                        <p className='text-red-500'>{error}</p>
                    </>
                ) : (
                    <Link to='/register'>
                        <button
                            className="bg-[#2a78d6] cursor-pointer rounded-lg w-25 flex justify-center items-center gap-1 h-10 text-white"
                        >Sign in
                        </button>
                    </Link>
                )}
            </div>
        </header>
    )
}