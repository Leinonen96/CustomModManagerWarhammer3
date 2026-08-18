# System Architecture

## Overview

This document outlines the architectural design of the Total War: WARHAMMER III Mod Manager, detailing the technology choices and system components that make up this cross-platform application.

## Backend

### Technology: Python

#### Reason
- **Excellent filesystem APIs**: Python's robust file system handling capabilities are essential for managing mod files and creating symlinks
- **Cross-platform**: Ensures consistent behavior across Windows, macOS, and Linux environments
- **Simple packaging**: Enables straightforward deployment and distribution of the application
- **Good AI tooling**: Leverages Python's extensive ecosystem for potential future AI integrations

## Frontend

### Technology: Progressive Web Application (PWA)

#### Reason
- **Modern UI**: Provides a contemporary user interface with smooth interactions
- **Cross-platform**: Delivers consistent experience across different operating systems
- **Native feeling**: Offers app-like experience with offline capabilities and responsive design
- **Simple deployment**: Easy distribution through web browsers without complex installation processes
- **Future proof**: PWA technology continues to evolve with modern web standards

## Communication

### Technology: REST API

#### Reason
- **Loose coupling**: Enables independent development and evolution of frontend and backend components
- **Frontend replaceable**: Allows for future frontend redesigns or alternative interfaces without affecting backend logic
- **Backend replaceable**: Supports potential backend technology migrations or improvements without disrupting frontend functionality

## System Components

```text
┌─────────────────┐    ┌─────────────────┐    ┌──────────────────────┐
│   Frontend      │    │   REST API      │    │ Backend (Modular)    │
│   (PWA)         │───▶│ (Routes Module) │───▶│ - core.py (Logic)  │
└─────────────────┘    └─────────────────┘    │ - config.py (State)  │
                                              │ - tray.py (OS UI)    │
                                              └──────────────────────┘
                                                         │
                                                         ▼
                                               ┌─────────────────┐
                                               │   File System   │
                                               │   Operations    │
                                               └─────────────────┘