'use client'

import React, { useEffect, useRef, useState } from 'react'
import { BookOpenText, Home, ShoppingCart } from 'lucide-react'

interface MobileNavbarProps {
  activeTab: string
  onTabChange: (tabId: string) => void
}

const bgColorsBody: Record<string, string> = {
  home: '#f3f7e7',
  khata: '#fce5e5',
  collections: '#dcfafb',
  add: '#f7e8fa',
}

const tabs = [
  {
    id: 'home',
    title: 'Home',
    color: '#6ab04c',
    icon: Home,
  },
  {
    id: 'collections',
    title: 'Sales',
    color: '#4834d4',
    icon: ShoppingCart,
  },
  {
    id: 'khata',
    title: 'Khata',
    color: '#eb4d4b',
    icon: BookOpenText,
  },
]

const MobileNavbar: React.FC<MobileNavbarProps> = ({ activeTab, onTabChange }) => {
  const menuRef = useRef<HTMLMenuElement | null>(null)
  const borderRef = useRef<HTMLDivElement | null>(null)
  const [hidden, setHidden] = useState(false)
  const lastScroll = useRef(0)

  useEffect(() => {
    const onScroll = () => {
      const cur = window.scrollY
      if (cur > lastScroll.current && cur > 50) setHidden(true)
      else if (cur < lastScroll.current) setHidden(false)
      lastScroll.current = cur
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const handleTabChange = (tabId: string) => {
    onTabChange(tabId)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  useEffect(() => {
    const offsetMenuBorder = () => {
      const activeItem = menuRef.current?.querySelector('.active')
      if (activeItem && borderRef.current && menuRef.current) {
        const rect = (activeItem as HTMLElement).getBoundingClientRect()
        const menuRect = menuRef.current!.getBoundingClientRect()
        const left = Math.floor(rect.left - menuRect.left - (borderRef.current.offsetWidth - rect.width) / 2) + 'px'
        borderRef.current.style.transform = `translate3d(${left}, 0, 0)`
      }
    }

    requestAnimationFrame(() => {
      offsetMenuBorder()
    })

    window.addEventListener('resize', offsetMenuBorder)
    document.body.style.backgroundColor = bgColorsBody[activeTab] || '#badc58'

    return () => {
      window.removeEventListener('resize', offsetMenuBorder)
    }
  }, [activeTab])

  useEffect(() => {
    return () => {
      document.body.style.backgroundColor = ''
    }
  }, [])

  return (
    <div className={`nav-wrapper fixed bottom-0 left-0 right-0 transition-transform duration-300 ${hidden ? 'translate-y-full' : 'translate-y-0'}`}>
      <menu className="menu" ref={menuRef}>
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              type="button"
              key={tab.id}
              className={`menu__item ${activeTab === tab.id ? 'active' : ''}`}
              style={{ '--bgColorItem': tab.color } as React.CSSProperties}
              onClick={() => handleTabChange(tab.id)}
              title={tab.title}
              aria-label={tab.title}
              aria-current={activeTab === tab.id ? 'page' : undefined}
            >
              <Icon className="icon" />
              <span className="menu__label">{tab.title}</span>
            </button>
          )
        })}
        <div className="menu__border" ref={borderRef}></div>
      </menu>

      <div className="svg-container">
        <svg viewBox="0 0 202.9 45.5">
          <clipPath id="menu" clipPathUnits="objectBoundingBox" transform="scale(0.0049285362247413 0.021978021978022)">
            <path d="M6.7,45.5c5.7,0.1,14.1-0.4,23.3-4c5.7-2.3,9.9-5,18.1-10.5c10.7-7.1,11.8-9.2,20.6-14.3c5-2.9,9.2-5.2,15.2-7 c7.1-2.1,13.3-2.3,17.6-2.1c4.2-0.2,10.5,0.1,17.6,2.1c6.1,1.8,10.2,4.1,15.2,7c8.8,5,9.9,7.1,20.6,14.3c8.3,5.5,12.4,8.2,18.1,10.5 c9.2,3.6,17.6,4.2,23.3,4H6.7z" />
          </clipPath>
        </svg>
      </div>
    </div>
  )
}

export default MobileNavbar
