import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import * as THREE from 'three'

/**
 * A procedurally generated environment map.
 *
 * Clearcoat and specular need something to reflect or the covers read as flat
 * primitives. Rather than fetching an HDR, a small equirectangular gradient is
 * painted and pre-filtered on the GPU — no network request, a few KB of VRAM, and
 * the reflection matches the lighting rig by construction.
 */
export function ProceduralEnvironment({ intensity = 0.32 }: { intensity?: number }) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)

  useEffect(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 256
    const ctx = canvas.getContext('2d')!

    // Sky → horizon → floor, in the same warm register as the page.
    const g = ctx.createLinearGradient(0, 0, 0, 256)
    g.addColorStop(0, '#4a4038')
    g.addColorStop(0.42, '#6b5c50')
    g.addColorStop(0.52, '#2a2220')
    g.addColorStop(1, '#141010')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 512, 256)

    // Key-light source, matching Lighting.tsx's front-upper-left direction.
    const key = ctx.createRadialGradient(150, 62, 4, 150, 62, 110)
    key.addColorStop(0, 'rgba(255, 244, 226, 0.95)')
    key.addColorStop(1, 'rgba(255, 244, 226, 0)')
    ctx.fillStyle = key
    ctx.fillRect(0, 0, 512, 256)

    // Cool rim source, behind right.
    const rim = ctx.createRadialGradient(392, 96, 4, 392, 96, 90)
    rim.addColorStop(0, 'rgba(196, 214, 236, 0.55)')
    rim.addColorStop(1, 'rgba(196, 214, 236, 0)')
    ctx.fillStyle = rim
    ctx.fillRect(0, 0, 512, 256)

    const texture = new THREE.CanvasTexture(canvas)
    texture.mapping = THREE.EquirectangularReflectionMapping
    texture.colorSpace = THREE.SRGBColorSpace

    const pmrem = new THREE.PMREMGenerator(gl)
    pmrem.compileEquirectangularShader()
    const envRT = pmrem.fromEquirectangular(texture)

    scene.environment = envRT.texture
    scene.environmentIntensity = intensity

    texture.dispose()
    pmrem.dispose()

    return () => {
      scene.environment = null
      envRT.dispose()
    }
  }, [gl, scene, intensity])

  return null
}
