import { PerspectiveCamera } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Suspense, useCallback, useEffect } from 'react'
import * as THREE from 'three'
import { usePointer } from '../../hooks/usePointer'
import type { SceneConfig } from '../../lib/sceneConfig'
import { useSceneStore } from '../../lib/store'
import { disposeAllTextures } from '../../textures/bookTextures'
import { BookStack } from '../Book/BookStack'
import { CameraController } from './CameraController'
import { ProceduralEnvironment } from './Environment'
import { Lighting } from './Lighting'
import styles from './BookScene.module.css'

type Props = {
  config: SceneConfig
  onSelect: (slug: string) => void
  reducedMotion: boolean
}

export function BookScene({ config, onSelect, reducedMotion }: Props) {
  const pointer = usePointer()
  const setWebglEnabled = useSceneStore((s) => s.setWebglEnabled)

  useEffect(() => () => disposeAllTextures(), [])

  const onCreated = useCallback(
    ({ gl }: { gl: THREE.WebGLRenderer }) => {
      gl.toneMapping = THREE.ACESFilmicToneMapping
      gl.toneMappingExposure = 1.04
      gl.outputColorSpace = THREE.SRGBColorSpace
      gl.setClearAlpha(0)

      // A lost context must degrade to the static shelf, never to a blank canvas.
      gl.domElement.addEventListener('webglcontextlost', (e) => {
        e.preventDefault()
        setWebglEnabled(false)
      })
    },
    [setWebglEnabled],
  )

  return (
    <div className={styles.canvasHost} aria-hidden="true">
      <Canvas
        dpr={config.dpr}
        shadows={config.shadows}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        onCreated={onCreated}
        frameloop="always"
      >
        <PerspectiveCamera
          makeDefault
          fov={config.camera.shelf.fov}
          position={config.camera.shelf.position}
          near={0.1}
          far={40}
        />
        <CameraController config={config} pointer={pointer} reducedMotion={reducedMotion} />
        <Lighting config={config} />
        <ProceduralEnvironment />

        <Suspense fallback={null}>
          <BookStack
            config={config}
            onSelect={onSelect}
            reducedMotion={reducedMotion}
            anisotropy={config.shadows ? 8 : 4}
          />
        </Suspense>

        {/* No ground plane: the camera sits almost coplanar with the books' base,
            so a contact shadow would cost a render target and be invisible. The
            books shadow each other from the key light instead. */}
      </Canvas>
    </div>
  )
}
