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
      center: [-78.6382, 35.7796],
      zoom: 9
    })

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right')
  }, [])

  useEffect(() => {
    if (!map.current || jobs.length === 0) return

    map.current.on('load', () => {
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
              url: job.url
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
        const coords = (e.features![0].geometry as GeoJSON.Point).coordinates.slice() as [number, number]

        const salary = props.salary_min && props.salary_max
          ? `$${(props.salary_min/1000).toFixed(0)}k - $${(props.salary_max/1000).toFixed(0)}k`
          : props.salary_min
            ? `From $${(props.salary_min/1000).toFixed(0)}k`
            : ''

        new mapboxgl.Popup({ offset: 25, maxWidth: '320px' })
          .setLngLat(coords)
          .setHTML(`
            <div class="job-card">
              <div class="job-card-header">
                <div class="job-card-company">${props.company}</div>
                <h3 class="job-card-title">${props.title}</h3>
                <div class="job-card-location">${props.location}</div>
              </div>
              ${salary ? `<div class="job-card-salary">${salary}</div>` : ''}
              <a href="${props.url}" target="_blank" class="job-card-button">View Job →</a>
            </div>
          `)
          .addTo(map.current!)
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
        <div className="logo-group">
          <h1 className="logo">JobCrush</h1>
          <span className="tagline">Find jobs near you</span>
        </div>
      </header>
      <div id="map" ref={mapContainer} />
    </div>
  )
}
