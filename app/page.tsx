'use client'

import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!

interface Job {
  id: string
  title: string
  company: string
  location: string
  latitude: number
  longitude: number
  salary_min: number | null
  salary_max: number | null
  url: string
}

export default function Home() {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const [jobs, setJobs] = useState<Job[]>([])

  useEffect(() => {
    if (map.current) return

    map.current = new mapboxgl.Map({
      container: mapContainer.current!,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [-78.6382, 35.7796], // Raleigh
      zoom: 10
    })

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right')
  }, [])

  useEffect(() => {
    if (!map.current || jobs.length === 0) return

    jobs.forEach((job) => {
      if (!job.latitude || !job.longitude) return

      const salary = job.salary_min && job.salary_max
        ? `$${(job.salary_min/1000).toFixed(0)}k - $${(job.salary_max/1000).toFixed(0)}k`
        : job.salary_min
        ? `From $${(job.salary_min/1000).toFixed(0)}k`
        : ''

      const popup = new mapboxgl.Popup({ offset: 25, maxWidth: '320px' }).setHTML(`
        <div class="job-card">
          <div class="job-card-header">
            <div class="job-card-company">${job.company}</div>
            <h3 class="job-card-title">${job.title}</h3>
            <div class="job-card-location">${job.location}</div>
          </div>
          ${salary ? `<div class="job-card-salary">${salary}</div>` : ''}
          <a href="${job.url}" target="_blank" class="job-card-button">View Job →</a>
        </div>
      `)

      new mapboxgl.Marker({ color: '#2563eb' })
        .setLngLat([job.longitude, job.latitude])
        .setPopup(popup)
        .addTo(map.current!)
    })
  }, [jobs])

  useEffect(() => {
    fetchJobs()
  }, [])

  async function fetchJobs() {
    const res = await fetch('/api/jobs')
    const data = await res.json()
    setJobs(data)
  }

  return (
  <div className="app-container">
    <header className="header">
      <h1 className="logo">JobCrush</h1>
    </header>
    <div id="map" ref={mapContainer} />
  </div>
)
  
}
