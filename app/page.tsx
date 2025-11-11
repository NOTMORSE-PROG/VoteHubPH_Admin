"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { CheckCircle, XCircle, Clock, Loader2, User, Shield, ChevronDown, ChevronUp, RefreshCw, Users, AlertCircle } from "lucide-react"

interface Post {
  id: number
  user_id: string
  name: string
  level: string
  position: string
  bio: string
  platform: string | null
  education: Array<{ level: string; school: string }> | null
  achievements: string[] | null
  images: Array<{ url: string; caption: string }> | null
  profile_photo?: string | null
  party?: string | null
  party_list_managed?: boolean | null // Track if party list has been managed
  status: "pending" | "approved" | "rejected"
  admin_notes: string | null
  user: {
    id: string
    name: string
    email: string
  }
  created_at: string
  updated_at: string
}

export default function AdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [filteredPosts, setFilteredPosts] = useState<Post[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending")
  const [rejectNotes, setRejectNotes] = useState<Record<number, string>>({})
  const [processingIds, setProcessingIds] = useState<Set<number>>(new Set())
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({})
  const [partyListModals, setPartyListModals] = useState<Record<number, boolean>>({})
  const [existingPartyLists, setExistingPartyLists] = useState<Record<number, any[]>>({})
  const [searchPartyList, setSearchPartyList] = useState<Record<number, string>>({})
  const [isSearchingPartyList, setIsSearchingPartyList] = useState<Record<number, boolean>>({})
  const [selectedPartyListId, setSelectedPartyListId] = useState<Record<number, number | null>>({})
  const [isProcessingPartyList, setIsProcessingPartyList] = useState<Record<number, boolean>>({})
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastFetchRef = useRef<number>(0)
  const isInitialMount = useRef(true)

  // Check authentication on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const authenticated = localStorage.getItem('admin_authenticated') === 'true'
      setIsAuthenticated(authenticated)
      if (!authenticated) {
        setIsLoading(false)
      }
    }
  }, [])

  const fetchPosts = useCallback(async (silent = false) => {
    if (!isAuthenticated) {
      return
    }
    
    if (!silent) {
      setIsLoading(true)
    } else {
      setIsRefreshing(true)
    }
    
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'
      const adminUserId = typeof window !== 'undefined' ? localStorage.getItem('admin_user_id') : null
      
      const response = await fetch(`${apiUrl}/admin/posts`, {
        credentials: "include",
        cache: 'no-store', // Prevent caching
        headers: adminUserId ? {
          'X-User-Id': adminUserId,
        } : {},
      })
      if (response.ok) {
        const data = await response.json()
        // Ensure data is an array
        if (Array.isArray(data)) {
          setPosts(data)
          lastFetchRef.current = Date.now()
        } else {
          console.error("Invalid response format - expected array, got:", data)
          setPosts([])
        }
      } else {
        // Try to parse error message
        try {
          const errorData = await response.json()
          console.error("Failed to fetch posts:", errorData)
        } catch (e) {
          console.error("Failed to fetch posts: HTTP", response.status)
        }
        setPosts([])
      }
    } catch (error) {
      console.error("Failed to fetch posts:", error)
      setPosts([])
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  // Initial fetch
  useEffect(() => {
    if (isAuthenticated === true) {
      fetchPosts()
      isInitialMount.current = false
    }
  }, [isAuthenticated, fetchPosts])

  // Auto-refresh every 30 seconds when tab is visible
  useEffect(() => {
    const setupAutoRefresh = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }

      intervalRef.current = setInterval(() => {
        // Only refresh if tab is visible
        if (document.visibilityState === 'visible') {
          const now = Date.now()
          // Don't refresh if we just fetched (within last 10 seconds)
          if (now - lastFetchRef.current > 10000) {
            fetchPosts(true) // Silent refresh
          }
        }
      }, 60000) // 60 seconds (reduced frequency for better performance)
    }

    setupAutoRefresh()

    // Handle visibility change
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Refresh immediately when tab becomes visible (if enough time has passed)
        const now = Date.now()
        if (now - lastFetchRef.current > 10000) {
          fetchPosts(true)
        }
        setupAutoRefresh()
      } else {
        // Clear interval when tab is hidden
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [fetchPosts])

  // Update filtered posts when filter or posts change
  useEffect(() => {
    if (filter === "all") {
      setFilteredPosts(posts)
    } else {
      setFilteredPosts(posts.filter((p) => p.status === filter))
    }
  }, [filter, posts])

  // Auto-refresh when filter changes (but not on initial mount)
  useEffect(() => {
    // Skip refresh on initial mount
    if (!isInitialMount.current && posts.length > 0) {
      fetchPosts(true)
    }
  }, [filter, fetchPosts, posts.length])

  const handleManualRefresh = () => {
    fetchPosts(false)
  }

  const handleApprove = async (postId: number) => {
    // Prevent multiple clicks
    if (processingIds.has(postId)) {
      return
    }
    
    setProcessingIds(new Set(processingIds).add(postId))
    
    // Optimistic update: update UI immediately
    setPosts(prevPosts => 
      prevPosts.map(post => 
        post.id === postId 
          ? { ...post, status: 'approved' as const }
          : post
      )
    )
    
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'
      const adminUserId = typeof window !== 'undefined' ? localStorage.getItem('admin_user_id') : null
      
      const response = await fetch(`${apiUrl}/admin/posts/${postId}/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          ...(adminUserId ? { 'X-User-Id': adminUserId } : {}),
        },
        credentials: "include",
      })
      if (response.ok) {
        // Sync with server (silent refresh to avoid loading state)
        await fetchPosts(true)
      } else {
        // Revert on error
        await fetchPosts(true)
      }
    } catch (error) {
      console.error("Failed to approve post:", error)
      // Revert on error
      await fetchPosts(true)
    } finally {
      const newProcessingIds = new Set(processingIds)
      newProcessingIds.delete(postId)
      setProcessingIds(newProcessingIds)
    }
  }

  const handleReject = async (postId: number) => {
    // Prevent multiple clicks
    if (processingIds.has(postId)) {
      return
    }
    
    setProcessingIds(new Set(processingIds).add(postId))
    const adminNotes = rejectNotes[postId] || "Post rejected by admin"
    
    // Optimistic update: update UI immediately
    setPosts(prevPosts => 
      prevPosts.map(post => 
        post.id === postId 
          ? { ...post, status: 'rejected' as const, admin_notes: adminNotes }
          : post
      )
    )
    
    // Clear reject notes immediately
    setRejectNotes((prev) => {
      const newNotes = { ...prev }
      delete newNotes[postId]
      return newNotes
    })
    
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'
      const adminUserId = typeof window !== 'undefined' ? localStorage.getItem('admin_user_id') : null
      
      const response = await fetch(`${apiUrl}/admin/posts/${postId}/reject`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Accept": "application/json",
          ...(adminUserId ? { 'X-User-Id': adminUserId } : {}),
        },
        body: JSON.stringify({ admin_notes: adminNotes }),
        credentials: "include",
      })
      if (response.ok) {
        // Sync with server (silent refresh to avoid loading state)
        await fetchPosts(true)
      } else {
        // Revert on error
        await fetchPosts(true)
      }
    } catch (error) {
      console.error("Failed to reject post:", error)
      // Revert on error
      await fetchPosts(true)
    } finally {
      const newProcessingIds = new Set(processingIds)
      newProcessingIds.delete(postId)
      setProcessingIds(newProcessingIds)
    }
  }

  // Redirect to login if not authenticated
  if (isAuthenticated === false) {
    if (typeof window !== 'undefined') {
      window.location.href = '/login'
    }
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (isLoading || isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  const stats = {
    total: posts.length,
    pending: posts.filter((p) => p.status === "pending").length,
    approved: posts.filter((p) => p.status === "approved").length,
    rejected: posts.filter((p) => p.status === "rejected").length,
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">VoteHubPH Admin</h1>
                <p className="text-sm text-gray-500">Post Moderation Dashboard</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={handleManualRefresh}
                disabled={isRefreshing || isLoading}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition"
                title="Refresh data"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                {isRefreshing ? 'Refreshing...' : 'Refresh'}
              </button>
              <a
                href={process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000'}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                View Main Site →
              </a>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-3xl font-bold text-gray-900">{stats.total}</div>
            <p className="text-sm text-gray-500 mt-1">Total Posts</p>
          </div>
          <div
            className="bg-white rounded-lg shadow p-6 cursor-pointer hover:shadow-md transition"
            onClick={() => setFilter("pending")}
          >
            <div className="text-3xl font-bold text-yellow-600">{stats.pending}</div>
            <p className="text-sm text-gray-500 mt-1">Pending Review</p>
          </div>
          <div
            className="bg-white rounded-lg shadow p-6 cursor-pointer hover:shadow-md transition"
            onClick={() => setFilter("approved")}
          >
            <div className="text-3xl font-bold text-green-600">{stats.approved}</div>
            <p className="text-sm text-gray-500 mt-1">Approved</p>
          </div>
          <div
            className="bg-white rounded-lg shadow p-6 cursor-pointer hover:shadow-md transition"
            onClick={() => setFilter("rejected")}
          >
            <div className="text-3xl font-bold text-red-600">{stats.rejected}</div>
            <p className="text-sm text-gray-500 mt-1">Rejected</p>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6 bg-white rounded-lg shadow p-2">
          <button
            onClick={() => setFilter("all")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${
              filter === "all"
                ? "bg-blue-600 text-white"
                : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            All Posts
          </button>
          <button
            onClick={() => setFilter("pending")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${
              filter === "pending"
                ? "bg-yellow-600 text-white"
                : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            Pending
          </button>
          <button
            onClick={() => setFilter("approved")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${
              filter === "approved"
                ? "bg-green-600 text-white"
                : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            Approved
          </button>
          <button
            onClick={() => setFilter("rejected")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${
              filter === "rejected"
                ? "bg-red-600 text-white"
                : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            Rejected
          </button>
        </div>

        {/* Posts List */}
        <div className="space-y-6">
          {filteredPosts.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <p className="text-gray-500">No posts found</p>
            </div>
          ) : (
            filteredPosts.map((post) => (
              <div key={post.id} className="bg-white rounded-lg shadow">
                {/* Post Header */}
                <div className="border-b border-gray-200 p-6">
                  <div className="flex items-start gap-4">
                    {/* Profile Photo - Always prioritize profile_photo, never replace with campaign images */}
                    <div className="flex-shrink-0">
                      <img
                        src={
                          post.profile_photo 
                            ? post.profile_photo 
                            : `https://ui-avatars.com/api/?name=${encodeURIComponent(post.name)}&size=96&background=random`
                        }
                        alt={post.name}
                        className="w-24 h-24 rounded-full object-cover border-2 border-gray-200"
                      />
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold text-gray-900">{post.name}</h3>
                        {post.status === "pending" && (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            <Clock className="h-3 w-3" />
                            Pending
                          </span>
                        )}
                        {post.status === "approved" && (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <CheckCircle className="h-3 w-3" />
                            Approved
                          </span>
                        )}
                        {post.status === "rejected" && (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            <XCircle className="h-3 w-3" />
                            Rejected
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                        <User className="h-4 w-4" />
                        <span>{post.user.name} ({post.user.email})</span>
                      </div>
                      <div className="flex gap-4 text-sm text-gray-600">
                        <span className="font-medium">{post.position}</span>
                        <span>•</span>
                        <span>{post.level}</span>
                        {post.party && (
                          <>
                            <span>•</span>
                            <span className="font-medium text-blue-600">{post.party}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-right text-sm text-gray-500 flex-shrink-0">
                      <div>Submitted</div>
                      <div className="font-medium">{new Date(post.created_at).toLocaleDateString()}</div>
                      <div className="text-xs">{new Date(post.created_at).toLocaleTimeString()}</div>
                    </div>
                  </div>
                </div>

                {/* Post Content */}
                <div className="p-6 space-y-4">
                  {/* Bio Section with Expandable Summary */}
                  <div>
                    <h4 className="font-semibold text-sm text-gray-700 mb-2">Bio</h4>
                    {(() => {
                      const bioKey = `bio-${post.id}`
                      const isExpanded = expandedSections[bioKey] || false
                      const shouldTruncate = post.bio && post.bio.length > 200
                      const displayText = shouldTruncate && !isExpanded 
                        ? post.bio.substring(0, 200) + '...' 
                        : post.bio
                      
                      return (
                        <div>
                          <p className="text-gray-600 whitespace-pre-wrap break-words">{displayText}</p>
                          {shouldTruncate && (
                            <button
                              onClick={() => setExpandedSections(prev => ({ ...prev, [bioKey]: !isExpanded }))}
                              className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                            >
                              {isExpanded ? (
                                <>
                                  <ChevronUp className="h-4 w-4" />
                                  Show Less
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="h-4 w-4" />
                                  Show More
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      )
                    })()}
                  </div>

                  {/* Platform & Advocacy Section with Expandable Summary */}
                  {post.platform && (
                    <div>
                      <h4 className="font-semibold text-sm text-gray-700 mb-2">Platform & Advocacy</h4>
                      {(() => {
                        const platformKey = `platform-${post.id}`
                        const isExpanded = expandedSections[platformKey] || false
                        const shouldTruncate = post.platform && post.platform.length > 200
                        const displayText = shouldTruncate && !isExpanded 
                          ? post.platform.substring(0, 200) + '...' 
                          : post.platform
                        
                        return (
                          <div>
                            <p className="text-gray-600 whitespace-pre-wrap break-words">{displayText}</p>
                            {shouldTruncate && (
                              <button
                                onClick={() => setExpandedSections(prev => ({ ...prev, [platformKey]: !isExpanded }))}
                                className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                              >
                                {isExpanded ? (
                                  <>
                                    <ChevronUp className="h-4 w-4" />
                                    Show Less
                                  </>
                                ) : (
                                  <>
                                    <ChevronDown className="h-4 w-4" />
                                    Show More
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        )
                      })()}
                    </div>
                  )}

                  {post.education && post.education.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-sm text-gray-700 mb-2">Education</h4>
                      <ul className="space-y-1">
                        {post.education.map((edu, idx) => (
                          <li key={idx} className="text-gray-600 text-sm">
                            • {edu.level} - {edu.school}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {post.achievements && post.achievements.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-sm text-gray-700 mb-2">Achievements</h4>
                      <ul className="space-y-1">
                        {post.achievements.map((achievement, idx) => (
                          <li key={idx} className="text-gray-600 text-sm">
                            ✓ {achievement}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {post.images && post.images.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-sm text-gray-700 mb-3">
                        Campaign Images ({post.images.length})
                      </h4>
                      <div className="grid grid-cols-2 gap-4">
                        {post.images.map((img, idx) => {
                          const captionKey = `caption-${post.id}-${idx}`
                          const isExpanded = expandedSections[captionKey] || false
                          const shouldTruncate = img.caption && img.caption.length > 100
                          const displayCaption = shouldTruncate && !isExpanded 
                            ? img.caption.substring(0, 100) + '...' 
                            : img.caption
                          
                          return (
                            <div key={idx} className="space-y-2">
                              <div className="relative h-48 rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
                                <img
                                  src={img.url}
                                  alt={img.caption || `Image ${idx + 1}`}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              {img.caption && (
                                <div>
                                  <p className="text-xs text-gray-600 italic whitespace-pre-wrap break-words">
                                    {displayCaption}
                                  </p>
                                  {shouldTruncate && (
                                    <button
                                      onClick={() => setExpandedSections(prev => ({ ...prev, [captionKey]: !isExpanded }))}
                                      className="mt-1 text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                                    >
                                      {isExpanded ? (
                                        <>
                                          <ChevronUp className="h-3 w-3" />
                                          Show Less
                                        </>
                                      ) : (
                                        <>
                                          <ChevronDown className="h-3 w-3" />
                                          Show More
                                        </>
                                      )}
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Party List Notification - Only show if party list hasn't been managed yet */}
                  {post.party && post.status === "pending" && !post.party_list_managed && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <h4 className="font-semibold text-sm text-yellow-800 mb-1 flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            Party List Detected
                          </h4>
                          <p className="text-sm text-yellow-700 mb-3">
                            This candidate has specified a party list: <strong>{post.party}</strong>
                          </p>
                          <button
                            onClick={() => setPartyListModals(prev => ({ ...prev, [post.id]: true }))}
                            className="text-sm bg-yellow-600 text-white px-4 py-2 rounded-md hover:bg-yellow-700 font-medium"
                          >
                            Manage Party List
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {post.admin_notes && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <h4 className="font-semibold text-sm text-red-800 mb-1">Admin Notes</h4>
                      <p className="text-sm text-red-700">{post.admin_notes}</p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                {post.status === "pending" && (
                  <div className="border-t border-gray-200 p-6 bg-gray-50">
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <textarea
                          placeholder="Add notes for rejection (optional)..."
                          value={rejectNotes[post.id] || ""}
                          onChange={(e) =>
                            setRejectNotes((prev) => ({ ...prev, [post.id]: e.target.value }))
                          }
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            handleApprove(post.id)
                          }}
                          disabled={processingIds.has(post.id)}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
                        >
                          {processingIds.has(post.id) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <CheckCircle className="h-4 w-4" />
                              Approve
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            handleReject(post.id)
                          }}
                          disabled={processingIds.has(post.id)}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
                        >
                          {processingIds.has(post.id) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <XCircle className="h-4 w-4" />
                              Reject
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </main>

      {/* Party List Management Modal */}
      {filteredPosts.map((post) => (
        partyListModals[post.id] && post.party && (
          <div key={`modal-${post.id}`} className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-gray-900">Manage Party List</h3>
                  <button
                    onClick={() => setPartyListModals(prev => ({ ...prev, [post.id]: false }))}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <XCircle className="h-6 w-6" />
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      <strong>Candidate:</strong> {post.name}
                    </p>
                    <p className="text-sm text-blue-800">
                      <strong>Party List:</strong> {post.party}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Search for existing party list
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search by name or acronym..."
                        value={searchPartyList[post.id] || ""}
                        onChange={async (e) => {
                          const query = e.target.value
                          setSearchPartyList(prev => ({ ...prev, [post.id]: query }))
                          setSelectedPartyListId(prev => ({ ...prev, [post.id]: null }))
                          
                          if (query.length >= 2) {
                            setIsSearchingPartyList(prev => ({ ...prev, [post.id]: true }))
                            try {
                              const response = await fetch(
                                `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'}/admin/partylists/search?q=${encodeURIComponent(query)}`,
                                { credentials: "include" }
                              )
                              if (response.ok) {
                                const data = await response.json()
                                setExistingPartyLists(prev => ({ ...prev, [post.id]: data }))
                              }
                            } catch (error) {
                              console.error("Failed to search party lists:", error)
                            } finally {
                              setIsSearchingPartyList(prev => ({ ...prev, [post.id]: false }))
                            }
                          } else {
                            setExistingPartyLists(prev => ({ ...prev, [post.id]: [] }))
                          }
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      {isSearchingPartyList[post.id] && (
                        <div className="absolute right-3 top-2.5">
                          <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                        </div>
                      )}
                    </div>
                    
                    {/* Search Results */}
                    {existingPartyLists[post.id] && existingPartyLists[post.id].length > 0 && (
                      <div className="mt-2 border border-gray-200 rounded-md max-h-48 overflow-y-auto">
                        {existingPartyLists[post.id].map((pl: any) => (
                          <button
                            key={pl.id}
                            onClick={() => setSelectedPartyListId(prev => ({ ...prev, [post.id]: pl.id }))}
                            className={`w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 ${
                              selectedPartyListId[post.id] === pl.id ? 'bg-blue-50 border-blue-200' : ''
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium text-sm text-gray-900">{pl.name}</p>
                                {pl.acronym && (
                                  <p className="text-xs text-gray-500">{pl.acronym}</p>
                                )}
                                {pl.sector && (
                                  <p className="text-xs text-gray-400 mt-0.5">Sector: {pl.sector}</p>
                                )}
                              </div>
                              <div className="text-xs text-gray-500">
                                {pl.member_count || 0} members
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    {searchPartyList[post.id] && searchPartyList[post.id].length >= 2 && 
                     existingPartyLists[post.id] && existingPartyLists[post.id].length === 0 && 
                     !isSearchingPartyList[post.id] && (
                      <p className="text-xs text-gray-500 mt-2">No party lists found matching "{searchPartyList[post.id]}"</p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      Search for an existing party list to add this candidate to, or create a new one below.
                    </p>
                  </div>

                  <div className="border-t pt-4">
                    <div className="flex gap-3">
                      <button
                        onClick={async () => {
                          const partyListId = selectedPartyListId[post.id]
                          if (!partyListId) {
                            alert("Please select a party list from the search results first")
                            return
                          }
                          
                          setIsProcessingPartyList(prev => ({ ...prev, [post.id]: true }))
                          try {
                            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'
                            const adminUserId = typeof window !== 'undefined' ? localStorage.getItem('admin_user_id') : null
                            
                            const response = await fetch(
                              `${apiUrl}/admin/partylists/${partyListId}/members`,
                              {
                                method: "POST",
                                headers: { 
                                  "Content-Type": "application/json",
                                  ...(adminUserId ? { 'X-User-Id': adminUserId } : {}),
                                },
                                credentials: "include",
                                body: JSON.stringify({ post_id: post.id }),
                              }
                            )
                            
                            if (response.ok) {
                              alert(`Successfully added "${post.name}" to the party list!`)
                              setPartyListModals(prev => ({ ...prev, [post.id]: false }))
                              setSearchPartyList(prev => ({ ...prev, [post.id]: "" }))
                              setSelectedPartyListId(prev => ({ ...prev, [post.id]: null }))
                              // Mark party list as managed by updating the post
                              setPosts(prev => prev.map(p => 
                                p.id === post.id ? { ...p, party_list_managed: true } : p
                              ))
                              await fetchPosts()
                            } else {
                              const error = await response.json()
                              alert(error.message || "Failed to add member to party list")
                            }
                          } catch (error) {
                            console.error("Failed to add member:", error)
                            alert("Failed to add member to party list")
                          } finally {
                            setIsProcessingPartyList(prev => ({ ...prev, [post.id]: false }))
                          }
                        }}
                        disabled={!selectedPartyListId[post.id] || isProcessingPartyList[post.id]}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm flex items-center justify-center gap-2"
                      >
                        {isProcessingPartyList[post.id] ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Adding...
                          </>
                        ) : (
                          "Add to Existing Party List"
                        )}
                      </button>
                      <button
                        onClick={async () => {
                          setIsProcessingPartyList(prev => ({ ...prev, [post.id]: true }))
                          try {
                            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'
                            const adminUserId = typeof window !== 'undefined' ? localStorage.getItem('admin_user_id') : null
                            
                            const response = await fetch(
                              `${apiUrl}/admin/partylists`,
                              {
                                method: "POST",
                                headers: { 
                                  "Content-Type": "application/json",
                                  ...(adminUserId ? { 'X-User-Id': adminUserId } : {}),
                                },
                                credentials: "include",
                                body: JSON.stringify({
                                  name: post.party,
                                  post_id: post.id,
                                  platform: post.platform ? (typeof post.platform === 'string' ? [post.platform] : post.platform) : [],
                                }),
                              }
                            )
                            
                            if (response.ok) {
                              alert(`Successfully created party list "${post.party}" and added "${post.name}" as a member!`)
                              setPartyListModals(prev => ({ ...prev, [post.id]: false }))
                              setSearchPartyList(prev => ({ ...prev, [post.id]: "" }))
                              // Mark party list as managed by updating the post
                              setPosts(prev => prev.map(p => 
                                p.id === post.id ? { ...p, party_list_managed: true } : p
                              ))
                              await fetchPosts()
                            } else {
                              const error = await response.json()
                              alert(error.message || "Failed to create party list")
                            }
                          } catch (error) {
                            console.error("Failed to create party list:", error)
                            alert("Failed to create party list")
                          } finally {
                            setIsProcessingPartyList(prev => ({ ...prev, [post.id]: false }))
                          }
                        }}
                        disabled={isProcessingPartyList[post.id]}
                        className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm flex items-center justify-center gap-2"
                      >
                        {isProcessingPartyList[post.id] ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          "Create New Party List"
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      ))}
    </div>
  )
}
