import React, { useState, useEffect } from 'react';
import {
  Phone,
  HeartPulse,
  Compass,
  Building2,
  PackageCheck,
  Bookmark,
  BookmarkCheck,
  Search,
  X,
  AlertTriangle,
  ExternalLink,
  MapPin,
  CheckCircle2,
  WifiOff
} from 'lucide-react';
import {
  getEmergencyResourcesFromDB,
  saveEmergencyResourcesToDB,
  toggleSaveEmergencyResourceInDB
} from '../services/db';
import { INITIAL_EMERGENCY_RESOURCES } from '../data/emergencyData';

const EmergencyResourcesModal = ({ isOpen, onClose, userLocation }) => {
  const [activeTab, setActiveTab] = useState('helpline');
  const [resources, setResources] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSavedOnly, setFilterSavedOnly] = useState(false);
  const [loading, setLoading] = useState(true);

  // Initialize and load emergency resources from IndexedDB
  useEffect(() => {
    if (!isOpen) return;

    const loadData = async () => {
      setLoading(true);
      try {
        let data = await getEmergencyResourcesFromDB();
        if (!data || data.length === 0) {
          // First time seeding into IndexedDB
          await saveEmergencyResourcesToDB(INITIAL_EMERGENCY_RESOURCES);
          data = await getEmergencyResourcesFromDB();
        }
        setResources(data || []);
      } catch (e) {
        console.error('Failed to load emergency resources from DB:', e);
        setResources(INITIAL_EMERGENCY_RESOURCES);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [isOpen]);

  const handleToggleBookmark = async (id, e) => {
    e.stopPropagation();
    try {
      const updated = await toggleSaveEmergencyResourceInDB(id);
      if (updated) {
        setResources((prev) =>
          prev.map((item) => (item.id === id ? { ...item, isSaved: updated.isSaved } : item))
        );
      }
    } catch (err) {
      console.error('Failed to toggle bookmark:', err);
    }
  };

  if (!isOpen) return null;

  // Filter items based on active category, search query, and saved filter
  const filteredResources = resources.filter((item) => {
    const matchesCategory = filterSavedOnly ? true : item.category === activeTab;
    const matchesSaved = filterSavedOnly ? item.isSaved : true;
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !query ||
      item.title?.toLowerCase().includes(query) ||
      item.description?.toLowerCase().includes(query) ||
      item.number?.includes(query) ||
      item.address?.toLowerCase().includes(query);

    return matchesCategory && matchesSaved && matchesSearch;
  });

  const tabs = [
    { id: 'helpline', label: 'Helplines', icon: <Phone size={16} /> },
    { id: 'first_aid', label: 'First Aid', icon: <HeartPulse size={16} /> },
    { id: 'evacuation', label: 'Evacuation', icon: <Compass size={16} /> },
    { id: 'shelter', label: 'Shelters & Hospitals', icon: <Building2 size={16} /> },
    { id: 'preparedness', label: 'Go-Bag & Prep', icon: <PackageCheck size={16} /> },
  ];

  return (
    <div className="emergency-modal-backdrop" onClick={onClose}>
      <div className="emergency-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="emergency-modal-header">
          <div className="emergency-header-title">
            <div className="emergency-icon-badge">
              <HeartPulse size={22} color="#FFFFFF" />
            </div>
            <div>
              <h2>Emergency Offline Resources</h2>
              <p className="emergency-subtitle">
                <WifiOff size={13} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
                100% Available Offline — Instant Guidance & Helplines
              </p>
            </div>
          </div>
          <button className="close-btn" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="emergency-filter-bar">
          <div className="emergency-search-input-wrapper">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Search helplines, first aid, shelters..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="emergency-search-input"
            />
            {searchQuery && (
              <button
                className="clear-search-btn"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
              >
                &times;
              </button>
            )}
          </div>

          <button
            type="button"
            className={`btn-saved-filter ${filterSavedOnly ? 'active' : ''}`}
            onClick={() => setFilterSavedOnly(!filterSavedOnly)}
            title="Show Bookmarked Resources"
          >
            {filterSavedOnly ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
            <span>Saved ({resources.filter((r) => r.isSaved).length})</span>
          </button>
        </div>

        {/* Navigation Tabs */}
        {!filterSavedOnly && (
          <div className="emergency-tabs-container">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`emergency-tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Content Body */}
        <div className="emergency-modal-body">
          {loading ? (
            <div className="emergency-loading-state">Loading emergency offline resources...</div>
          ) : filteredResources.length === 0 ? (
            <div className="emergency-empty-state">
              <AlertTriangle size={36} color="var(--primary)" />
              <p>No resources found matching your criteria</p>
            </div>
          ) : (
            <div className="emergency-resource-list">
              {filteredResources.map((item) => (
                <div key={item.id} className="emergency-resource-card">
                  <div className="emergency-card-top">
                    <div className="emergency-card-heading">
                      <span className="emergency-badge">{item.category.replace('_', ' ').toUpperCase()}</span>
                      <h3 className="emergency-card-title">{item.title}</h3>
                    </div>
                    <button
                      type="button"
                      className="bookmark-btn"
                      onClick={(e) => handleToggleBookmark(item.id, e)}
                      title={item.isSaved ? 'Remove from Saved' : 'Save for Quick Offline Access'}
                      aria-label="Bookmark"
                    >
                      {item.isSaved ? (
                        <BookmarkCheck size={18} color="#DC2626" />
                      ) : (
                        <Bookmark size={18} color="var(--text-dim)" />
                      )}
                    </button>
                  </div>

                  {/* Helpline Details */}
                  {item.number && (
                    <div className="emergency-phone-section">
                      <div className="phone-number-display">
                        <Phone size={18} color="#DC2626" />
                        <span className="phone-number">{item.number}</span>
                      </div>
                      <a href={`tel:${item.number}`} className="btn btn-call-now">
                        <Phone size={14} />
                        <span>Dial Now</span>
                      </a>
                    </div>
                  )}

                  {/* Summary / Description */}
                  {item.description && <p className="emergency-card-desc">{item.description}</p>}
                  {item.summary && <p className="emergency-card-desc">{item.summary}</p>}

                  {/* Steps for First Aid / Evacuation */}
                  {item.steps && (
                    <div className="emergency-steps-box">
                      <h4 className="steps-title">Action Steps:</h4>
                      <ol className="emergency-steps-list">
                        {item.steps.map((step, idx) => (
                          <li key={idx}>{step}</li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {/* Checklist items for Go-Bag / Prep */}
                  {item.items && (
                    <div className="emergency-steps-box">
                      <h4 className="steps-title">Required Supplies:</h4>
                      <ul className="emergency-checklist">
                        {item.items.map((it, idx) => (
                          <li key={idx}>
                            <CheckCircle2 size={14} color="#DC2626" style={{ flexShrink: 0, marginTop: 2 }} />
                            <span>{it}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Shelters & Hospitals Facilities & Contact */}
                  {item.address && (
                    <div className="emergency-shelter-info">
                      <div className="shelter-meta-row">
                        <MapPin size={14} color="var(--primary)" />
                        <span>{item.address}</span>
                      </div>
                      {item.capacity && (
                        <div className="shelter-meta-row">
                          <strong>Capacity:</strong> {item.capacity}
                        </div>
                      )}
                      {item.phone && (
                        <div className="shelter-meta-row">
                          <Phone size={14} color="#DC2626" />
                          <a href={`tel:${item.phone}`} className="shelter-phone-link">
                            {item.phone}
                          </a>
                        </div>
                      )}
                      {item.facilities && (
                        <div className="shelter-facilities">
                          {item.facilities.map((fac, idx) => (
                            <span key={idx} className="facility-pill">
                              {fac}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Critical Warnings */}
                  {item.warnings && (
                    <div className="emergency-warning-box">
                      <AlertTriangle size={15} color="#EA4335" style={{ flexShrink: 0, marginTop: 2 }} />
                      <span>{item.warnings}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="emergency-modal-footer">
          <span className="emergency-footer-note">
            * All emergency helplines and instructions are stored locally on your device for immediate offline access.
          </span>
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmergencyResourcesModal;
