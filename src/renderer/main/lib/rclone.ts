import axios from 'axios'
import types from 'licia/types'
import singleton from 'licia/singleton'
import { notify } from 'share/renderer/lib/util'
import { t } from '../../../common/util'

type ConfigDump = types.PlainObj<{
  type: string
  provider?: string
}>

export type File = {
  ID: string
  IsDir: boolean
  MimeType: string
  Name: string
  Size: number
  ModTime: string
  Path: string
}

export type Stats = {
  bytes: number
  totalBytes: number
  transfers: number
  totalTransfers: number
}

export type Transfer = {
  name: string
  size: number
  bytes: number
}

export type Target = {
  fs: string
  remote: string
}

export type TargetPair = {
  srcFs: string
  srcRemote: string
  dstFs: string
  dstRemote: string
}

type OperationAsyncResult = {
  jobid: number
}

type JobStatus = {
  finished: boolean
  success: boolean
  startTime: string
  duration: number
}

const api = axios.create({
  baseURL: 'http://127.0.1:5572',
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    notify(t('reqErr'), { icon: 'error' })
    return Promise.reject(error)
  }
)

export async function getConfigDump(): Promise<ConfigDump> {
  const response = await api.post<ConfigDump>('/config/dump')

  return response.data
}

export async function deleteConfig(name: string) {
  await api.post('/config/delete', {
    name,
  })
}

export async function getFileList(target: Target): Promise<File[]> {
  const response = await api.post<{
    list: File[]
  }>('/operations/list', target)

  return response.data.list
}

export async function getFileStat(target: Target): Promise<File> {
  const response = await api.post<{
    item: File
  }>('/operations/stat', target)

  return response.data.item
}

export async function mkdir(target: Target) {
  await api.post('/operations/mkdir', target)
}

export async function purge(target: Target) {
  await api.post('/operations/purge', target)
}

export async function deleteFile(target: Target) {
  await api.post('/operations/deletefile', target)
}

export async function copyFile(targetPair: TargetPair): Promise<number> {
  const response = await api.post<OperationAsyncResult>(
    '/operations/copyfile',
    {
      ...targetPair,
      _async: true,
    }
  )

  return response.data.jobid
}

export async function copyDir(targetPair: TargetPair): Promise<number> {
  const response = await api.post<OperationAsyncResult>('/sync/copy', {
    srcFs: targetPair.srcFs + targetPair.srcRemote,
    dstFs: targetPair.dstFs + targetPair.dstRemote,
    _async: true,
    createEmptySrcDirs: true,
  })

  return response.data.jobid
}

export async function moveFile(targetPair: TargetPair): Promise<number> {
  const response = await api.post<OperationAsyncResult>(
    '/operations/movefile',
    {
      ...targetPair,
      _async: true,
    }
  )

  return response.data.jobid
}

export async function moveDir(targetPair: TargetPair): Promise<number> {
  const response = await api.post<OperationAsyncResult>('/sync/move', {
    srcFs: targetPair.srcFs + targetPair.srcRemote,
    dstFs: targetPair.dstFs + targetPair.dstRemote,
    _async: true,
    createEmptySrcDirs: true,
    deleteEmptySrcDirs: true,
  })

  return response.data.jobid
}

export async function getStatusForJob(jobId: number): Promise<JobStatus> {
  const response = await api.post<JobStatus>('/job/status', {
    jobid: jobId,
  })

  return response.data
}

export async function stats(jobId?: number): Promise<Stats> {
  const data: any = {}
  if (jobId) {
    data.group = `job/${jobId}`
  }

  const response = await api.post<Stats>('/core/stats', data)

  return response.data
}

export async function transferred(jobId: number): Promise<Transfer[]> {
  const response = await api.post<{
    transferred: Transfer[]
  }>('/core/transferred', {
    group: `job/${jobId}`,
  })

  return response.data.transferred
}

export async function stopJob(jobId: number) {
  await api.post('/job/stop', {
    jobid: jobId,
  })
}

let isInit = false
export const wait = singleton(async function (checkInterval = 5) {
  if (!isInit) {
    const port = await main.getRclonePort()
    api.defaults.baseURL = `http://127.0.0.1:${port}`
    const auth = await main.getRcloneAuth()
    api.defaults.headers.common['Authorization'] = `Basic ${auth}`
    isInit = true
  }

  return new Promise((resolve) => {
    async function check() {
      if (!(await main.isRcloneRunning())) {
        return resolve(false)
      }
      try {
        await stats()
        return resolve(true)
      } catch {
        // ignore
      }
      setTimeout(check, checkInterval * 1000)
    }
    check()
  })
})
