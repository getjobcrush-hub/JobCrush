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
  description: string
  url: string
  posted_at: string
}

export default function Home() {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const [jobs, setJobs] = useState<Job[]>([])
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)

  useEffect(() => {
    if (map.current) return

    map.current = new mapboxgl.Map({
      container: mapContainer.current!,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [-78.6382, 35.7796],
      zoom: 9
    })

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right')
    
    map.current.on('load', () => {
      setMapLoaded(true)
    })
  }, [])

  useEffect(() => {
    if (!map.current || jobs.length === 0 || !mapLoaded) return

    const geojson: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: jobs
        .filter(job => job.latitude && job.longitude)
        .map(job => ({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [job.longitude, job.latitude]
          },
          properties: {
            id: job.id,
            title: job.title,
            company: job.company,
            location: job.location,
            salary_min: job.salary_min,
            salary_max: job.salary_max,
            description: job.description,
            url: job.url,
            posted_at: job.posted_at
          }
        }))
    }

    if (map.current!.getSource('jobs')) {
      (map.current!.getSource('jobs') as mapboxgl.GeoJSONSource).setData(geojson)
      return
    }

    map.current!.addSource('jobs', {
      type: 'geojson',
      data: geojson,
      cluster: true,
      clusterMaxZoom: 14,
      clusterRadius: 50
    })

    map.current!.addLayer({
      id: 'clusters',
      type: 'circle',
      source: 'jobs',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': [
          'step',
          ['get', 'point_count'],
          '#2563eb',
          10, '#1d4ed8',
          30, '#1e40af'
        ],
        'circle-radius': [
          'step',
          ['get', 'point_count'],
          20,
          10, 25,
          30, 30
        ]
      }
    })

    map.current!.addLayer({
      id: 'cluster-count',
      type: 'symbol',
      source: 'jobs',
      filter: ['has', 'point_count'],
      layout: {
        'text-field': ['get', 'point_count_abbreviated'],
        'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
        'text-size': 12
      },
      paint: {
        'text-color': '#ffffff'
      }
    })

    map.current!.addLayer({
      id: 'unclustered-point',
      type: 'circle',
      source: 'jobs',
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-color': '#2563eb',
        'circle-radius': 8,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff'
      }
    })

    map.current!.on('click', 'clusters', (e) => {
      const features = map.current!.queryRenderedFeatures(e.point, { layers: ['clusters'] })
      const clusterId = features[0].properties!.cluster_id
      const source = map.current!.getSource('jobs') as mapboxgl.GeoJSONSource
      source.getClusterExpansionZoom(clusterId, (err, zoom) => {
        if (err) return
        map.current!.easeTo({
          center: (features[0].geometry as GeoJSON.Point).coordinates as [number, number],
          zoom: zoom!
        })
      })
    })

    map.current!.on('click', 'unclustered-point', (e) => {
      const props = e.features![0].properties!
      const job: Job = {
        id: props.id,
        title: props.title,
        company: props.company,
        location: props.location,
        latitude: 0,
        longitude: 0,
        salary_min: props.salary_min,
        salary_max: props.salary_max,
        description: props.description,
        url: props.url,
        posted_at: props.posted_at
      }
      setSelectedJob(job)
    })

    map.current!.on('mouseenter', 'clusters', () => {
      map.current!.getCanvas().style.cursor = 'pointer'
    })
    map.current!.on('mouseleave', 'clusters', () => {
      map.current!.getCanvas().style.cursor = ''
    })
    map.current!.on('mouseenter', 'unclustered-point', () => {
      map.current!.getCanvas().style.cursor = 'pointer'
    })
    map.current!.on('mouseleave', 'unclustered-point', () => {
      map.current!.getCanvas().style.cursor = ''
    })
  }, [jobs, mapLoaded])

  useEffect(() => {
    fetchJobs()
  }, [])

  async function fetchJobs() {
    const res = await fetch('/api/jobs')
    const data = await res.json()
    setJobs(data)
  }

  function formatSalary(min: number | null, max: number | null) {
    if (min && max) return `$${(min/1000).toFixed(0)}k - $${(max/1000).toFixed(0)}k`
    if (min) return `From $${(min/1000).toFixed(0)}k`
    return null
  }

  function formatDate(dateStr: string) {
    const date = new Date(dateStr)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays === 0) return 'Posted today'
    if (diffDays === 1) return 'Posted yesterday'
    if (diffDays < 7) return `Posted ${diffDays} days ago`
    if (diffDays < 30) return `Posted ${Math.floor(diffDays / 7)} weeks ago`
    return `Posted ${Math.floor(diffDays / 30)} months ago`
  }

  return (
    <div className="app-container">
      <header className="header">
        <div className="logo-group">
          <h1 className="logo">JobCrush</h1>
          <span className="tagline">Find jobs near you</span>
        </div>
      </header>
      <div className="main-content">
        <div id="map" ref={mapContainer} />
        {selectedJob && (
          <div className="job-panel">
            <button className="panel-close" onClick={() => setSelectedJob(null)}>×</button>
            <div className="panel-content">
              <div className="panel-company">{selectedJob.company}</div>
              <h2 className="panel-title">{selectedJob.title}</h2>
              <div className="panel-location">{selectedJob.location}</div>
              
              <div className="panel-meta">
                {formatSalary(selectedJob.salary_min, selectedJob.salary_max) && (
                  <span className="panel-salary">{formatSalary(selectedJob.salary_min, selectedJob.salary_max)}</span>
                )}
                <span className="panel-date">{formatDate(selectedJob.posted_at)}</span>
              </div>

              <div className="panel-section">
                <h3>About this role</h3>
                <p>{selectedJob.description}</p>
              </div>

              <div className="panel-actions">
                <a href={selectedJob.url} target="_blank" className="btn-apply">Apply Now →</a>
                <button className="btn-save">♡ Save</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
