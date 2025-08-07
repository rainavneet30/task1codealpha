import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'; 
import { ActivatedRoute } from '@angular/router';
import { FilesService, File, FileVersion } from '../../../core/services/file.service';
import { ProjectService, Project } from '../../../core/services/project.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-file-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './file-list.component.html',
  styleUrls: ['./file-list.component.css']
})
export class FileListComponent implements OnInit {
  files: File[] = [];
  filteredFiles: File[] = []; 
  project?: Project;
  projectId = '';
  errorMessage = '';
  isGridView = true;
  activeMenuFileId: string | null = null;
  searchQuery = ''; 
  
  // Filter and sort properties
  selectedFilter = 'all';
  selectedSort = 'name-asc';
  showFilterDropdown = false;
  showSortDropdown = false;

  fileVersions: FileVersion[] = [];
  showVersionsModal = false;
  selectedFileName = '';

  // Delete confirmation modal properties
  showDeleteModal = false;
  deleteModalTitle = '';
  deleteModalMessage = '';
  itemToDelete: any = null;
  deleteType: 'file' | 'version' = 'file';

  // Tooltip properties
  showTooltip = false;
  tooltipContent = '';
  tooltipX = 0;
  tooltipY = 0;

  constructor(
    private route: ActivatedRoute,
    public fileService: FilesService,
    private projectService: ProjectService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.projectId = this.route.snapshot.paramMap.get('projectId') || '';
    if (this.projectId) {
      this.fetchProjectDetails();
      this.fetchAndSetApiKey();
    } else {
      this.errorMessage = 'Invalid Project ID';
    }
  }

  /** Fetch project details (name, description, tags, etc.) */
  fetchProjectDetails(): void {
    this.projectService.getAllProjects().subscribe({
      next: (projects) => {
        this.project = projects.find(p => p.id === this.projectId);
        // Apply filters after project is loaded to ensure dynamic filters work
        if (this.files.length > 0) {
          this.applyFiltersAndSort();
        }
      },
      error: (err) => console.error('Error fetching project details:', err)
    });
  }

  /** Fetch API keys and set default key for this project */
  fetchAndSetApiKey(): void {
    this.projectService.getKeys(this.projectId).subscribe({
      next: (res) => {
        const defaultKey = res.api_keys.find((k: any) => k.default)?.key;
        if (defaultKey) {
          this.authService.setApiKey(this.projectId, defaultKey);
          this.fetchFiles();
        } else {
          this.errorMessage = 'No default API key found for this project.';
        }
      },
      error: (err) => {
        console.error('Error fetching API keys:', err);
        this.errorMessage = 'Could not retrieve API key.';
      }
    });
  }

  /** Fetch files after API key is set */
  fetchFiles(): void {
    this.fileService.listFiles(this.projectId).subscribe({
      next: (data) => {
        console.log('Raw file data from backend:', data);
        this.files = data.map(file => ({
          ...file,
          has_versions: !!file.has_versions
        }));
        this.applyFiltersAndSort();
      },
      error: (err) => {
        this.errorMessage = 'Error fetching files.';
        console.error(err);
      },
    });
  }

  // Search functionality
  onSearchChange(): void {
    this.applyFiltersAndSort();
  }

  // Apply filters and sorting
  applyFiltersAndSort(): void {
    let filtered = [...this.files];

    // Apply search filter
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(file => 
        file.name.toLowerCase().includes(query) ||
        this.getFileType(file.name).toLowerCase().includes(query)
      );
    }

    // Apply type filter
    if (this.selectedFilter !== 'all') {
      filtered = filtered.filter(file => {
        const fileExt = file.name.split('.').pop()?.toLowerCase();
        
        // First check if the selected filter matches file extension directly
        if (fileExt === this.selectedFilter.toLowerCase()) {
          return true;
        }
        
        // Then check predefined type categories
        switch (this.selectedFilter.toLowerCase()) {
          case 'pdf':
            return fileExt === 'pdf';
          case 'doc':
          case 'docs':
          case 'document':
            return ['doc', 'docx', 'txt', 'rtf'].includes(fileExt || '');
          case 'image':
          case 'img':
          case 'png':
          case 'jpg':
          case 'jpeg':
            return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(fileExt || '');
          case 'video':
          case 'mp4':
            return ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv'].includes(fileExt || '');
          case 'audio':
          case 'mp3':
            return ['mp3', 'wav', 'flac', 'aac', 'ogg'].includes(fileExt || '');
          case 'archive':
          case 'zip':
            return ['zip', 'rar', '7z', 'tar', 'gz'].includes(fileExt || '');
          case 'code':
          case 'js':
          case 'javascript':
          case 'typescript':
          case 'ts':
            return ['js', 'ts', 'jsx', 'tsx', 'html', 'css', 'json', 'xml', 'py', 'java', 'cpp', 'c', 'php', 'rb', 'go', 'rs', 'swift', 'kt', 'sql'].includes(fileExt || '');
          default:
            // For any other filter types, try exact match with extension
            return fileExt === this.selectedFilter.toLowerCase();
        }
      });
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (this.selectedSort) {
        case 'name-asc':
          return a.name.localeCompare(b.name);
        case 'name-desc':
          return b.name.localeCompare(a.name);
        case 'size-asc':
          return a.size - b.size;
        case 'size-desc':
          return b.size - a.size;
        case 'date-asc':
          const dateA = new Date(a.updated_at || a.created_at || 0);
          const dateB = new Date(b.updated_at || b.created_at || 0);
          return dateA.getTime() - dateB.getTime();
        case 'date-desc':
          const dateC = new Date(a.updated_at || a.created_at || 0);
          const dateD = new Date(b.updated_at || b.created_at || 0);
          return dateD.getTime() - dateC.getTime();
        default:
          return 0;
      }
    });

    this.filteredFiles = filtered;
  }

  // Toggle filter dropdown
  toggleFilterDropdown(): void {
    this.showFilterDropdown = !this.showFilterDropdown;
    this.showSortDropdown = false;
  }

  // Toggle sort dropdown
  toggleSortDropdown(): void {
    this.showSortDropdown = !this.showSortDropdown;
    this.showFilterDropdown = false;
  }

  // Select filter
  selectFilter(filter: string): void {
    this.selectedFilter = filter;
    this.showFilterDropdown = false;
    this.applyFiltersAndSort();
  }

  // Select sort
  selectSort(sort: string): void {
    this.selectedSort = sort;
    this.showSortDropdown = false;
    this.applyFiltersAndSort();
  }

  // Clear all filters
  clearAllFilters(): void {
    this.searchQuery = '';
    this.selectedFilter = 'all';
    this.selectedSort = 'name-asc';
    this.applyFiltersAndSort();
  }

  // Close dropdowns when clicking outside
  @HostListener('document:click', ['$event'])
  closeDropdownsOnOutsideClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.filter-dropdown') && !target.closest('.sort-dropdown')) {
      this.showFilterDropdown = false;
      this.showSortDropdown = false;
    }
  }

  // Get available file types from project and existing files
  getAvailableFileTypes(): string[] {
    const types = new Set<string>();
    
    // Add project-defined types if available
    if (this.project && this.project.types) {
      this.project.types.forEach(type => types.add(type.toLowerCase()));
    }
    
    // Add file extensions from existing files
    this.files.forEach(file => {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext) {
        types.add(ext);
      }
    });
    
    // Convert to array and sort
    return Array.from(types).sort();
  }

  // Get filter display name
  getFilterDisplayName(): string {
    switch (this.selectedFilter) {
      case 'all': return 'All Files';
      default: 
        return this.getFilterDisplayText(this.selectedFilter);
    }
  }

  // Get display text for filter
  getFilterDisplayText(fileType: string): string {
    const typeMap: { [key: string]: string } = {
      'pdf': 'PDF Files',
      'doc': 'Document Files',
      'docs': 'Document Files', 
      'document': 'Document Files',
      'image': 'Image Files',
      'img': 'Image Files',
      'png': 'PNG Files',
      'jpg': 'JPEG Files',
      'jpeg': 'JPEG Files',
      'gif': 'GIF Files',
      'video': 'Video Files',
      'mp4': 'MP4 Files',
      'audio': 'Audio Files',
      'mp3': 'MP3 Files',
      'archive': 'Archive Files',
      'zip': 'ZIP Files',
      'code': 'Code Files',
      'js': 'JavaScript Files',
      'ts': 'TypeScript Files',
      'html': 'HTML Files',
      'css': 'CSS Files',
      'json': 'JSON Files',
      'xml': 'XML Files',
      'py': 'Python Files',
      'java': 'Java Files',
      'cpp': 'C++ Files',
      'c': 'C Files',
      'php': 'PHP Files',
      'txt': 'Text Files',
      'sql': 'SQL Files'
    };
    
    return typeMap[fileType.toLowerCase()] || `${fileType.toUpperCase()} Files`;
  }

  // Get icon for file type filter
  getFilterIcon(fileType: string): string {
    const iconMap: { [key: string]: string } = {
      'pdf': 'fas fa-file-pdf text-red-500',
      'doc': 'fas fa-file-word text-blue-500',
      'docs': 'fas fa-file-word text-blue-500',
      'document': 'fas fa-file-word text-blue-500',
      'txt': 'fas fa-file-alt text-gray-500',
      'image': 'fas fa-image text-green-500',
      'img': 'fas fa-image text-green-500',
      'png': 'fas fa-image text-green-500',
      'jpg': 'fas fa-image text-green-500',
      'jpeg': 'fas fa-image text-green-500',
      'gif': 'fas fa-image text-green-500',
      'svg': 'fas fa-image text-green-500',
      'video': 'fas fa-video text-orange-500',
      'mp4': 'fas fa-video text-orange-500',
      'avi': 'fas fa-video text-orange-500',
      'mov': 'fas fa-video text-orange-500',
      'audio': 'fas fa-music text-purple-500',
      'mp3': 'fas fa-music text-purple-500',
      'wav': 'fas fa-music text-purple-500',
      'archive': 'fas fa-archive text-yellow-500',
      'zip': 'fas fa-archive text-yellow-500',
      'rar': 'fas fa-archive text-yellow-500',
      '7z': 'fas fa-archive text-yellow-500',
      'code': 'fas fa-code text-gray-500',
      'js': 'fas fa-code text-yellow-600',
      'ts': 'fas fa-code text-blue-600',
      'html': 'fas fa-code text-orange-600',
      'css': 'fas fa-code text-blue-500',
      'json': 'fas fa-code text-green-600',
      'xml': 'fas fa-code text-orange-500',
      'py': 'fas fa-code text-green-600',
      'java': 'fas fa-code text-red-600',
      'cpp': 'fas fa-code text-blue-700',
      'c': 'fas fa-code text-blue-700',
      'php': 'fas fa-code text-purple-600',
      'sql': 'fas fa-database text-teal-500'
    };
    
    return iconMap[fileType.toLowerCase()] || 'fas fa-file text-gray-500';
  }

  // Get sort display name
  getSortDisplayName(): string {
    switch (this.selectedSort) {
      case 'name-asc': return 'Name (A-Z)';
      case 'name-desc': return 'Name (Z-A)';
      case 'size-asc': return 'Size (S→L)';
      case 'size-desc': return 'Size (L→S)';
      case 'date-asc': return 'Date (Old→New)';
      case 'date-desc': return 'Date (New→Old)';
      default: return 'Name (A-Z)';
    }
  }

  toggleView(): void {
    this.isGridView = !this.isGridView;
  }

  toggleMenu(fileId: string, event: MouseEvent): void {
    event.stopPropagation();
    event.preventDefault();
    this.activeMenuFileId = this.activeMenuFileId === fileId ? null : fileId;
  }

  @HostListener('document:click', ['$event'])
  closeMenuOnOutsideClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.dropdown-menu') && !target.closest('.menu-button')) {
      this.activeMenuFileId = null;
    }
  }

  closeMenu(): void {
    this.activeMenuFileId = null;
  }

  downloadFile(file: File | FileVersion): void {
    this.closeMenu();
    this.fileService.downloadFile(this.projectId, file.id).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        // Use the original filename, not the stored name
        const fileName = 'name' in file ? file.name : file.file_name;
        a.download = fileName;
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: (err) => {
        console.error('Error downloading file:', err);
        this.errorMessage = 'Error downloading file.';
        setTimeout(() => this.errorMessage = '', 5000);
      }
    });
  }

  replaceFile(file: File): void {
    this.closeMenu();
    const input = document.createElement('input');
    input.type = 'file';
    input.onchange = () => {
      const selectedFile = (input.files as FileList)[0];
      if (selectedFile) {
        this.fileService.replaceFile(this.projectId, file.id, selectedFile).subscribe({
          next: () => {
            console.log('File replaced successfully');
            this.fetchFiles();
          },
          error: (err) => console.error('Error replacing file:', err)
        });
      }
    };
    input.click();
  }

  viewVersions(file: File): void {
    this.closeMenu();
    if (file.has_versions) {
      this.fileService.listVersions(this.projectId, file.name).subscribe({
        next: (versions) => {
          this.fileVersions = versions;
          this.selectedFileName = file.name;
          this.showVersionsModal = true;
          
          // If there's only the original file (version 1), update has_versions to false
          if (versions.length <= 1) {
            const fileIndex = this.files.findIndex(f => f.name === file.name);
            if (fileIndex !== -1) {
              this.files[fileIndex].has_versions = false;
            }
            
            const filteredFileIndex = this.filteredFiles.findIndex(f => f.name === file.name);
            if (filteredFileIndex !== -1) {
              this.filteredFiles[filteredFileIndex].has_versions = false;
            }
          }
        },
        error: (err) => console.error('Error fetching versions:', err)
      });
    }
  }

  closeVersionsModal(): void {
    this.showVersionsModal = false;
    this.fileVersions = [];
    this.selectedFileName = '';
  }

  // Delete file version
  deleteFileVersion(version: FileVersion): void {
    // Prevent deletion of the original file (version 1)
    if (version.version === 1) {
      this.errorMessage = 'Cannot delete the original file. You can only delete newer versions.';
      setTimeout(() => {
        this.errorMessage = '';
      }, 5000);
      return;
    }

    this.itemToDelete = version;
    this.deleteType = 'version';
    this.deleteModalTitle = `Delete Version ${version.version}`;
    this.deleteModalMessage = `Are you sure you want to delete version ${version.version} of ${version.file_name}?`;
    this.showDeleteModal = true;
  }

  // Confirm delete version (called from template)
  confirmDeleteVersion(version: FileVersion): void {
    this.deleteFileVersion(version);
  }

  // Refresh versions list after deletion
  refreshVersionsList(): void {
    if (this.selectedFileName) {
      this.fileService.listVersions(this.projectId, this.selectedFileName).subscribe({
        next: (versions) => {
          this.fileVersions = versions;
        },
        error: (err) => console.error('Error refreshing versions:', err)
      });
    }
  }

  // Refresh versions list and update main file's has_versions property
  refreshVersionsListAndUpdateFile(): void {
    if (this.selectedFileName) {
      this.fileService.listVersions(this.projectId, this.selectedFileName).subscribe({
        next: (versions) => {
          this.fileVersions = versions;
          
          // Update the main file's has_versions property based on remaining versions
          // Only consider it has versions if there are more than just the original file (version 1)
          const hasVersions = versions.length > 1; // More than just the original file
          
          // Find and update the file in both files and filteredFiles arrays
          const fileIndex = this.files.findIndex(f => f.name === this.selectedFileName);
          if (fileIndex !== -1) {
            this.files[fileIndex].has_versions = hasVersions;
          }
          
          const filteredFileIndex = this.filteredFiles.findIndex(f => f.name === this.selectedFileName);
          if (filteredFileIndex !== -1) {
            this.filteredFiles[filteredFileIndex].has_versions = hasVersions;
          }
        },
        error: (err) => console.error('Error refreshing versions:', err)
      });
    }
  }

  deleteFile(file: File): void {
    this.itemToDelete = file;
    this.deleteType = 'file';
    this.deleteModalTitle = `Delete File: ${file.name}`;
    this.deleteModalMessage = `Are you sure you want to delete ${file.name}?`;
    this.showDeleteModal = true;
  }

  confirmDelete(): void {
    if (this.itemToDelete) {
      if (this.deleteType === 'version') {
        this.fileService.deleteFileVersion(this.projectId, this.itemToDelete.id).subscribe({
          next: () => {
            console.log('File version deleted successfully');
            this.errorMessage = ''; // Clear any previous errors
            
            // Refresh the entire file list to get updated data from backend
            this.fetchFiles();
            
            // Also refresh the versions list for the modal
            this.refreshVersionsListAndUpdateFile();
            
            this.showDeleteModal = false;
            this.itemToDelete = null;
            this.deleteType = 'file';
          },
          error: (err: any) => {
            console.error('Error deleting file version:', err);
            this.errorMessage = err.error?.message || 'Error deleting file version. Please try again.';
            // Clear error after 5 seconds
            setTimeout(() => {
              this.errorMessage = '';
            }, 5000);
            this.showDeleteModal = false;
            this.itemToDelete = null;
            this.deleteType = 'file';
          }
        });
      } else { // deleteType === 'file'
        this.fileService.deleteFile(this.projectId, this.itemToDelete.id).subscribe({
          next: () => {
            console.log('File deleted successfully');
            this.errorMessage = ''; // Clear any previous errors
            this.fetchFiles();
            this.showDeleteModal = false;
            this.itemToDelete = null;
            this.deleteType = 'file';
          },
          error: (err: any) => {
            console.error('Error deleting file:', err);
            this.errorMessage = err.error?.message || 'Error deleting file. Please try again.';
            // Clear error after 5 seconds
            setTimeout(() => {
              this.errorMessage = '';
            }, 5000);
            this.showDeleteModal = false;
            this.itemToDelete = null;
            this.deleteType = 'file';
          }
        });
      }
    }
  }

  cancelDelete(): void {
    this.showDeleteModal = false;
    this.itemToDelete = null;
    this.deleteType = 'file';
  }

  // Tooltip methods
  showFileTooltip(file: File, event: MouseEvent): void {
    // Debug: Log the file object to see what fields are available
    console.log('File object for tooltip:', file);
    
    // Use file's actual timestamp if available, otherwise fall back to current time
    let dateTime: Date;
    
    // Check for all possible timestamp fields in order of preference
    const timestamp = file.updated_at || file.updatedAt || file.updated || 
                     file.created_at || file.createdAt || file.created || 
                     file.timestamp || file.date;
    
    if (timestamp) {
      dateTime = new Date(timestamp);
      // Check if the date is valid
      if (isNaN(dateTime.getTime())) {
        dateTime = new Date(); // Fallback to current time if invalid date
      }
    } else {
      dateTime = new Date(); // Fallback to current time if no timestamp available
    }
    
    const date = dateTime.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    const time = dateTime.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit'
    });
    
    this.tooltipContent = `Type: ${this.getFileType(file.name)}\nSize: ${this.formatSize(file.size)}\nDate modified: ${date} ${time}`;
    
    // Improved positioning logic
    const offsetX = 15;
    const offsetY = -10;
    
    // Get viewport dimensions
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Calculate initial position
    let x = event.clientX + offsetX;
    let y = event.clientY + offsetY;
    
    // Estimate tooltip dimensions (adjust these values based on your tooltip content)
    const tooltipWidth = 250;
    const tooltipHeight = 80;
    
    // Adjust horizontal position if tooltip would go off-screen
    if (x + tooltipWidth > viewportWidth) {
      x = event.clientX - tooltipWidth - offsetX;
    }
    
    // Adjust vertical position if tooltip would go off-screen
    if (y + tooltipHeight > viewportHeight) {
      y = event.clientY - tooltipHeight - offsetY;
    }
    
    // Ensure tooltip doesn't go off the left or top edges
    x = Math.max(10, x);
    y = Math.max(10, y);
    
    this.tooltipX = x;
    this.tooltipY = y;
    this.showTooltip = true;
  }

  hideFileTooltip(): void {
    this.showTooltip = false;
  }

  formatSize(bytes: number): string {
    if (!bytes) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    const kb = bytes / 1024;
    if (kb < 1024) return kb.toFixed(2) + ' KB';
    const mb = kb / 1024;
    if (mb < 1024) return mb.toFixed(2) + ' MB';
    const gb = mb / 1024;
    return gb.toFixed(2) + ' GB';
  }

  /** Trigger upload */
  triggerFileUpload(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.onchange = () => {
      const selectedFile = (input.files as FileList)[0];
      if (selectedFile) {
        this.fileService.uploadFile(this.projectId, selectedFile).subscribe({
          next: () => {
            console.log('File uploaded successfully');
            this.fetchFiles();
          },
          error: (err) => console.error('Error uploading file:', err)
        });
      }
    };
    input.click();
  }

  /** Download all files as ZIP */
  downloadAllAsZip(): void {
    this.fileService.downloadAllAsZip(this.projectId).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.project?.name || 'project'}-files.zip`;
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: (err) => console.error('Error downloading zip:', err)
    });
  }

  getFileIconName(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (!ext) return 'fas fa-file';

    const iconMap: { [key: string]: string } = {
      // Images
      'png': 'fas fa-image',
      'jpg': 'fas fa-image',
      'jpeg': 'fas fa-image',
      'gif': 'fas fa-image',
      'webp': 'fas fa-image',
      'svg': 'fas fa-image',
      'bmp': 'fas fa-image',
      'ico': 'fas fa-image',

      // Documents
      'pdf': 'fas fa-file-pdf',
      'doc': 'fas fa-file-word',
      'docx': 'fas fa-file-word',
      'txt': 'fas fa-file-alt',
      'rtf': 'fas fa-file-alt',

      // Spreadsheets
      'xls': 'fas fa-file-excel',
      'xlsx': 'fas fa-file-excel',
      'csv': 'fas fa-file-csv',

      // Presentations
      'ppt': 'fas fa-file-powerpoint',
      'pptx': 'fas fa-file-powerpoint',

      // Videos
      'mp4': 'fas fa-file-video',
      'avi': 'fas fa-file-video',
      'mov': 'fas fa-file-video',
      'wmv': 'fas fa-file-video',
      'flv': 'fas fa-file-video',
      'webm': 'fas fa-file-video',
      'mkv': 'fas fa-file-video',

      // Audio
      'mp3': 'fas fa-file-audio',
      'wav': 'fas fa-file-audio',
      'flac': 'fas fa-file-audio',
      'aac': 'fas fa-file-audio',
      'ogg': 'fas fa-file-audio',

      // Archives
      'zip': 'fas fa-file-archive',
      'rar': 'fas fa-file-archive',
      '7z': 'fas fa-file-archive',
      'tar': 'fas fa-file-archive',
      'gz': 'fas fa-file-archive',

      // Code files
      'js': 'fas fa-file-code',
      'ts': 'fas fa-file-code',
      'jsx': 'fas fa-file-code',
      'tsx': 'fas fa-file-code',
      'vue': 'fas fa-file-code',
      'html': 'fas fa-file-code',
      'htm': 'fas fa-file-code',
      'css': 'fas fa-file-code',
      'scss': 'fas fa-file-code',
      'sass': 'fas fa-file-code',
      'less': 'fas fa-file-code',
      'json': 'fas fa-file-code',
      'xml': 'fas fa-file-code',
      'yaml': 'fas fa-file-code',
      'yml': 'fas fa-file-code',
      'py': 'fas fa-file-code',
      'java': 'fas fa-file-code',
      'cpp': 'fas fa-file-code',
      'c': 'fas fa-file-code',
      'php': 'fas fa-file-code',
      'rb': 'fas fa-file-code',
      'go': 'fas fa-file-code',
      'rs': 'fas fa-file-code',
      'swift': 'fas fa-file-code',
      'kt': 'fas fa-file-code',
      'sql': 'fas fa-database',

      // Other
      'exe': 'fas fa-cog',
      'dmg': 'fas fa-cog',
      'deb': 'fas fa-cog',
      'rpm': 'fas fa-cog',
    };

    return iconMap[ext] || 'fas fa-file';
  }

  getFileIconClass(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (!ext) return 'file-icon-default';

    const classMap: { [key: string]: string } = {
      // Images - Green
      'png': 'file-icon-img',
      'jpg': 'file-icon-img',
      'jpeg': 'file-icon-img',
      'gif': 'file-icon-img',
      'webp': 'file-icon-img',
      'svg': 'file-icon-img',
      'bmp': 'file-icon-img',
      'ico': 'file-icon-img',

      // Documents - Blue/Red
      'pdf': 'file-icon-pdf',
      'doc': 'file-icon-doc',
      'docx': 'file-icon-doc',
      'txt': 'file-icon-doc',
      'rtf': 'file-icon-doc',

      // Spreadsheets - Green
      'xls': 'file-icon-img',
      'xlsx': 'file-icon-img',
      'csv': 'file-icon-img',

      // Presentations - Orange
      'ppt': 'file-icon-video',
      'pptx': 'file-icon-video',

      // Videos - Orange
      'mp4': 'file-icon-video',
      'avi': 'file-icon-video',
      'mov': 'file-icon-video',
      'webm': 'file-icon-video',

      // Audio - Purple
      'mp3': 'file-icon-audio',
      'wav': 'file-icon-audio',
      'flac': 'file-icon-audio',
      'aac': 'file-icon-audio',
      'ogg': 'file-icon-audio',

      // Archives - Brown
      'zip': 'file-icon-archive',
      'rar': 'file-icon-archive',
      '7z': 'file-icon-archive',
      'tar': 'file-icon-archive',
      'gz': 'file-icon-archive',

      // Code files - Gray
      'js': 'file-icon-code',
      'ts': 'file-icon-code',
      'jsx': 'file-icon-code',
      'tsx': 'file-icon-code',
      'vue': 'file-icon-code',
      'html': 'file-icon-code',
      'htm': 'file-icon-code',
      'css': 'file-icon-code',
      'scss': 'file-icon-code',
      'sass': 'file-icon-code',
      'less': 'file-icon-code',
      'json': 'file-icon-code',
      'xml': 'file-icon-code',
      'yaml': 'file-icon-code',
      'yml': 'file-icon-code',
      'py': 'file-icon-code',
      'java': 'file-icon-code',
      'cpp': 'file-icon-code',
      'c': 'file-icon-code',
      'php': 'file-icon-code',
      'rb': 'file-icon-code',
      'go': 'file-icon-code',
      'rs': 'file-icon-code',
      'swift': 'file-icon-code',
      'kt': 'file-icon-code',
      'sql': 'file-icon-code',

      // Other - Default
      'exe': 'file-icon-default',
      'dmg': 'file-icon-default',
      'deb': 'file-icon-default',
      'rpm': 'file-icon-default',
    };

    return classMap[ext] || 'file-icon-default';
  }

  getFileType(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (!ext) return 'File';

    const typeMap: { [key: string]: string } = {
      // Images
      'png': 'PNG Image',
      'jpg': 'JPEG Image',
      'jpeg': 'JPEG Image',
      'gif': 'GIF Image',
      'webp': 'WebP Image',
      'svg': 'SVG Vector',
      'bmp': 'Bitmap Image',

      // Documents
      'pdf': 'PDF Document',
      'doc': 'Word Document',
      'docx': 'Word Document',
      'txt': 'Text File',
      'rtf': 'Rich Text',

      // Spreadsheets
      'xls': 'Excel File',
      'xlsx': 'Excel File',
      'csv': 'CSV Data',

      // Presentations
      'ppt': 'PowerPoint',
      'pptx': 'PowerPoint',

      // Videos
      'mp4': 'MP4 Video',
      'avi': 'AVI Video',
      'mov': 'QuickTime',
      'wmv': 'Windows Media',
      'webm': 'WebM Video',
      'mkv': 'Matroska Video',

      // Audio
      'mp3': 'MP3 Audio',
      'wav': 'WAV Audio',
      'flac': 'FLAC Audio',
      'aac': 'AAC Audio',

      // Archives
      'zip': 'ZIP Archive',
      'rar': 'RAR Archive',
      '7z': '7-Zip Archive',
      'tar': 'TAR Archive',

      // Code files
      'js': 'JavaScript',
      'ts': 'TypeScript',
      'jsx': 'React JSX',
      'tsx': 'React TSX',
      'html': 'HTML',
      'css': 'Stylesheet',
      'json': 'JSON Data',
      'xml': 'XML Data',
      'py': 'Python',
      'java': 'Java',
      'sql': 'SQL Database',
    };

    return typeMap[ext] || ext.toUpperCase() + ' File';
  }

  getFileTypeClass(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (!ext) return 'bg-gray-100 text-gray-800';

    const classMap: { [key: string]: string } = {
      // Images - Green
      'png': 'bg-green-100 text-green-800',
      'jpg': 'bg-green-100 text-green-800',
      'jpeg': 'bg-green-100 text-green-800',
      'gif': 'bg-green-100 text-green-800',
      'webp': 'bg-green-100 text-green-800',
      'svg': 'bg-green-100 text-green-800',

      // Documents
      'pdf': 'bg-red-100 text-red-800',
      'doc': 'bg-blue-100 text-blue-800',
      'docx': 'bg-blue-100 text-blue-800',
      'txt': 'bg-gray-100 text-gray-800',

      // Spreadsheets - Emerald
      'xls': 'bg-emerald-100 text-emerald-800',
      'xlsx': 'bg-emerald-100 text-emerald-800',
      'csv': 'bg-emerald-100 text-emerald-800',

      // Presentations - Orange
      'ppt': 'bg-orange-100 text-orange-800',
      'pptx': 'bg-orange-100 text-orange-800',

      // Videos - Pink
      'mp4': 'bg-pink-100 text-pink-800',
      'avi': 'bg-pink-100 text-pink-800',
      'mov': 'bg-pink-100 text-pink-800',
      'webm': 'bg-pink-100 text-pink-800',

      // Audio - Purple
      'mp3': 'bg-purple-100 text-purple-800',
      'wav': 'bg-purple-100 text-purple-800',
      'flac': 'bg-purple-100 text-purple-800',

      // Archives - Indigo
      'zip': 'bg-indigo-100 text-indigo-800',
      'rar': 'bg-indigo-100 text-indigo-800',
      '7z': 'bg-indigo-100 text-indigo-800',

      // Code files - Slate
      'js': 'bg-slate-100 text-slate-800',
      'ts': 'bg-slate-100 text-slate-800',
      'jsx': 'bg-slate-100 text-slate-800',
      'tsx': 'bg-slate-100 text-slate-800',
      'html': 'bg-slate-100 text-slate-800',
      'css': 'bg-slate-100 text-slate-800',
      'json': 'bg-slate-100 text-slate-800',
      'py': 'bg-slate-100 text-slate-800',
      'java': 'bg-slate-100 text-slate-800',
      'sql': 'bg-teal-100 text-teal-800',
    };

    return classMap[ext] || 'bg-gray-100 text-gray-800';
  }
}