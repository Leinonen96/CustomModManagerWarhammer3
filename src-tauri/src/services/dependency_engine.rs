use std::collections::{HashMap, HashSet, VecDeque};
use std::path::Path;
use crate::domain::Mod;
use crate::services::pack_parser::PackParser;

pub struct DependencyEngine;

impl DependencyEngine {
    /// Performs a Directed Acyclic Graph (DAG) topological sort on active mods.
    /// Prerequisite core mods (Mixer, MCT, Core Frameworks, Asset Packs) are sorted to load first.
    pub fn auto_sort_dependencies(active_mods: &[Mod]) -> Vec<Mod> {
        if active_mods.len() <= 1 {
            return active_mods.to_vec();
        }

        let mut mod_map: HashMap<String, Mod> = HashMap::new();
        let mut name_to_id: HashMap<String, String> = HashMap::new();

        for m in active_mods {
            mod_map.insert(m.name.clone(), m.clone());
            if !m.id.is_empty() {
                name_to_id.insert(m.id.clone(), m.name.clone());
            }
        }

        // 1. Build Dependency Graph
        // adj[A] = Vec<B> means A must load BEFORE B (A -> B)
        let mut adj: HashMap<String, Vec<String>> = HashMap::new();
        let mut in_degree: HashMap<String, usize> = HashMap::new();

        for m in active_mods {
            adj.entry(m.name.clone()).or_default();
            in_degree.entry(m.name.clone()).or_insert(0);
        }

        for m in active_mods {
            let path = Path::new(&m.real_path);
            let manifest = PackParser::parse_pack_file(path);

            for dep in &manifest.dependencies {
                // Try matching dependency by pack name or Steam ID
                let dep_name = if mod_map.contains_key(dep) {
                    Some(dep.clone())
                } else if let Some(matched) = name_to_id.get(dep) {
                    Some(matched.clone())
                } else {
                    None
                };

                if let Some(prereq) = dep_name {
                    if prereq != m.name {
                        adj.entry(prereq.clone()).or_default().push(m.name.clone());
                        *in_degree.entry(m.name.clone()).or_insert(0) += 1;
                    }
                }
            }

            // Heuristic detection for common Warhammer III core frameworks:
            // Core Unlockers / MCT / Frameworks should always load before submods
            let lower_name = m.name.to_lowercase();
            let is_core_framework = lower_name.contains("mixer")
                || lower_name.contains("mod_configuration_tool")
                || lower_name.contains("mct")
                || lower_name.contains("cai_framework")
                || lower_name.contains("community_framework");

            if is_core_framework {
                for other in active_mods {
                    if other.name != m.name {
                        let other_lower = other.name.to_lowercase();
                        if other_lower.contains("submod")
                            || other_lower.contains("patch")
                            || other_lower.contains("compatch")
                        {
                            adj.entry(m.name.clone()).or_default().push(other.name.clone());
                            *in_degree.entry(other.name.clone()).or_insert(0) += 1;
                        }
                    }
                }
            }
        }

        // 2. Kahn's Algorithm for Topological Sorting with Framework Priority
        let is_framework_name = |n: &str| -> bool {
            let l = n.to_lowercase();
            l.contains("mixer")
                || l.contains("unlocker")
                || l.contains("community_bugfix")
                || l.contains("cbfm")
                || l.contains("mod_configuration_tool")
                || l.contains("mct")
                || l.contains("cai_framework")
                || l.contains("ui_framework")
        };

        let mut ready_nodes: Vec<String> = in_degree
            .iter()
            .filter(|(_, &deg)| deg == 0)
            .map(|(name, _)| name.clone())
            .collect();

        // Sort ready nodes: Core frameworks first, then original order
        ready_nodes.sort_by_key(|n| if is_framework_name(n) { 0 } else { 1 });

        let mut queue: VecDeque<String> = ready_nodes.into();
        let mut sorted_names: Vec<String> = Vec::new();

        while let Some(node) = queue.pop_front() {
            sorted_names.push(node.clone());

            if let Some(neighbors) = adj.get(&node) {
                let mut newly_ready = Vec::new();
                for nbr in neighbors {
                    if let Some(deg) = in_degree.get_mut(nbr) {
                        *deg -= 1;
                        if *deg == 0 {
                            newly_ready.push(nbr.clone());
                        }
                    }
                }
                newly_ready.sort_by_key(|n| if is_framework_name(n) { 0 } else { 1 });
                for nr in newly_ready {
                    queue.push_back(nr);
                }
            }
        }

        // If cycle detected or not all resolved, append remaining in original order
        let mut visited: HashSet<String> = sorted_names.iter().cloned().collect();
        for m in active_mods {
            if !visited.contains(&m.name) {
                sorted_names.push(m.name.clone());
                visited.insert(m.name.clone());
            }
        }

        // Reconstruct sorted Mod slice
        let mut result = Vec::with_capacity(sorted_names.len());
        for name in sorted_names {
            if let Some(m) = mod_map.remove(&name) {
                result.push(m);
            }
        }

        result
    }

    /// Finds missing dependencies required by active mods
    pub fn find_missing_dependencies(active_mods: &[Mod]) -> HashMap<String, Vec<String>> {
        let active_set: HashSet<String> = active_mods.iter().map(|m| m.name.clone()).collect();
        let mut missing_map = HashMap::new();

        for m in active_mods {
            let path = Path::new(&m.real_path);
            let manifest = PackParser::parse_pack_file(path);
            let mut missing = Vec::new();

            for dep in &manifest.dependencies {
                if !active_set.contains(dep) {
                    missing.push(dep.clone());
                }
            }

            if !missing.is_empty() {
                missing_map.insert(m.name.clone(), missing);
            }
        }

        missing_map
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_auto_sort_empty_or_single() {
        let single = vec![Mod {
            id: "1".into(),
            name: "test.pack".into(),
            title: "Test".into(),
            real_path: "/dummy/test.pack".into(),
            ..Default::default()
        }];
        let sorted = DependencyEngine::auto_sort_dependencies(&single);
        assert_eq!(sorted.len(), 1);
        assert_eq!(sorted[0].name, "test.pack");
    }

    #[test]
    fn test_heuristic_framework_prioritization() {
        let mods = vec![
            Mod {
                id: "2".into(),
                name: "submod_patch.pack".into(),
                title: "Submod".into(),
                real_path: "/dummy/submod.pack".into(),
                ..Default::default()
            },
            Mod {
                id: "1".into(),
                name: "!mixer_core.pack".into(),
                title: "Mixer Core".into(),
                real_path: "/dummy/mixer.pack".into(),
                ..Default::default()
            },
        ];

        let sorted = DependencyEngine::auto_sort_dependencies(&mods);
        assert_eq!(sorted.len(), 2);
        assert_eq!(sorted[0].name, "!mixer_core.pack");
        assert_eq!(sorted[1].name, "submod_patch.pack");
    }
}

