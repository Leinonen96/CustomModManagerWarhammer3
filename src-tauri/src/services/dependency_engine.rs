use crate::domain::{Mod, RuleType, UserOverrideRule};
use crate::services::pack_parser::PackParser;
use std::collections::{HashMap, HashSet, VecDeque};
use std::path::Path;

pub struct DependencyEngine;

impl DependencyEngine {
    /// Performs a DAG topological sort on active mods with backwards-compatible defaults.
    pub fn auto_sort_dependencies(active_mods: &[Mod]) -> Vec<Mod> {
        Self::auto_sort_dependencies_with_rules(active_mods, &HashMap::new(), &[])
    }

    /// Performs a Directed Acyclic Graph (DAG) topological sort on active mods.
    /// Injects persistent User Override Rules, respects Pinned Mod anchors, and resolves micro-patches.
    pub fn auto_sort_dependencies_with_rules(
        active_mods: &[Mod],
        pinned_mods: &HashMap<String, usize>,
        user_rules: &[UserOverrideRule],
    ) -> Vec<Mod> {
        if active_mods.len() <= 1 {
            return active_mods.to_vec();
        }

        // Separate pinned mods from unpinned mods
        let mut pinned_entries: HashMap<usize, Mod> = HashMap::new();
        let mut unpinned_mods: Vec<Mod> = Vec::new();

        let mut mod_map: HashMap<String, Mod> = HashMap::new();
        let mut name_to_id: HashMap<String, String> = HashMap::new();

        for m in active_mods {
            mod_map.insert(m.name.clone(), m.clone());
            if !m.id.is_empty() {
                name_to_id.insert(m.id.clone(), m.name.clone());
            }

            // Check if mod is pinned
            let pinned_pos = pinned_mods.get(&m.name).or_else(|| {
                if !m.id.is_empty() {
                    pinned_mods.get(&m.id)
                } else {
                    None
                }
            });

            if let Some(&pos) = pinned_pos {
                pinned_entries.insert(pos, m.clone());
            } else {
                unpinned_mods.push(m.clone());
            }
        }

        // 1. Build Dependency Graph for ALL unpinned mods
        // adj[A] = Vec<B> means A must load BEFORE B (A -> B, A takes priority over B)
        let mut adj: HashMap<String, Vec<String>> = HashMap::new();
        let mut in_degree: HashMap<String, usize> = HashMap::new();

        for m in &unpinned_mods {
            adj.entry(m.name.clone()).or_default();
            in_degree.entry(m.name.clone()).or_insert(0);
        }

        // Parse manifests for all unpinned mods with mtime-caching
        let mut mod_files: HashMap<String, HashSet<String>> = HashMap::new();
        for m in &unpinned_mods {
            let path = Path::new(&m.real_path);
            let manifest = PackParser::parse_pack_file(path);

            let files: HashSet<String> = manifest.files.iter().map(|f| f.to_lowercase()).collect();
            mod_files.insert(m.name.clone(), files);

            // A. Pack Header Explicit Dependency Resolution
            for dep in &manifest.dependencies {
                let dep_name = if mod_map.contains_key(dep) {
                    Some(dep.clone())
                } else {
                    name_to_id.get(dep).cloned()
                };

                if let Some(prereq) = dep_name {
                    if prereq != m.name && in_degree.contains_key(&prereq) {
                        // Master Framework / Prerequisite (prereq) must load FIRST before dependent mod (m)
                        adj.entry(prereq.clone()).or_default().push(m.name.clone());
                        *in_degree.entry(m.name.clone()).or_insert(0) += 1;
                    }
                }
            }
        }

        // B. Inject Persistent User Override Rules (Highest Priority)
        for rule in user_rules {
            let source_name = if mod_map.contains_key(&rule.source_mod) {
                Some(rule.source_mod.clone())
            } else {
                name_to_id.get(&rule.source_mod).cloned()
            };

            let target_name = if mod_map.contains_key(&rule.target_mod) {
                Some(rule.target_mod.clone())
            } else {
                name_to_id.get(&rule.target_mod).cloned()
            };

            if let (Some(src), Some(tgt)) = (source_name, target_name) {
                if src != tgt && in_degree.contains_key(&src) && in_degree.contains_key(&tgt) {
                    match rule.rule_type {
                        RuleType::Above => {
                            // Source must load BEFORE Target
                            adj.entry(src).or_default().push(tgt.clone());
                            *in_degree.entry(tgt).or_insert(0) += 1;
                        }
                        RuleType::Below => {
                            // Target must load BEFORE Source
                            adj.entry(tgt).or_default().push(src.clone());
                            *in_degree.entry(src).or_insert(0) += 1;
                        }
                    }
                }
            }
        }

        // C. Triple-Check Micro-Patch / Submod Auto-Resolver
        for (i, mod_a) in unpinned_mods.iter().enumerate() {
            let mod_a_name = &mod_a.name;
            let files_a = match mod_files.get(mod_a_name) {
                Some(f) if !f.is_empty() && f.len() <= 25 => f,
                _ => continue,
            };

            for (j, mod_b) in unpinned_mods.iter().enumerate() {
                if i == j {
                    continue;
                }
                let mod_b_name = &mod_b.name;
                let files_b = match mod_files.get(mod_b_name) {
                    Some(f) if f.len() >= 30 && f.len() >= files_a.len() * 3 => f,
                    _ => continue,
                };

                let collisions = files_a
                    .iter()
                    .filter(|path| files_b.contains(*path))
                    .count();
                if collisions == 0 {
                    continue;
                }

                let containment_ratio = (collisions as f64) / (files_a.len() as f64);
                if containment_ratio >= 0.50 || collisions >= 4 {
                    adj.entry(mod_a_name.clone())
                        .or_default()
                        .push(mod_b_name.clone());
                    *in_degree.entry(mod_b_name.clone()).or_insert(0) += 1;
                }
            }
        }

        // 2. Kahn's Algorithm for Topological Sorting with ASCII Packfile Priority
        let mut ready_nodes: Vec<String> = in_degree
            .iter()
            .filter(|(_, &deg)| deg == 0)
            .map(|(name, _)| name.clone())
            .collect();

        ready_nodes.sort_by_key(|a| a.to_lowercase());

        let mut queue: VecDeque<String> = ready_nodes.into();
        let mut sorted_unpinned_names: Vec<String> = Vec::new();

        while let Some(node) = queue.pop_front() {
            sorted_unpinned_names.push(node.clone());

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
                newly_ready.sort_by_key(|a| a.to_lowercase());
                for nr in newly_ready {
                    queue.push_back(nr);
                }
            }
        }

        // Cycle fallback for any remaining unvisited nodes
        if sorted_unpinned_names.len() < unpinned_mods.len() {
            let visited: HashSet<String> = sorted_unpinned_names.iter().cloned().collect();
            let mut remaining: Vec<String> = unpinned_mods
                .iter()
                .filter(|m| !visited.contains(&m.name))
                .map(|m| m.name.clone())
                .collect();
            remaining.sort_by_key(|a| a.to_lowercase());
            sorted_unpinned_names.extend(remaining);
        }

        let unpinned_sorted_mods: Vec<Mod> = sorted_unpinned_names
            .into_iter()
            .filter_map(|name| mod_map.remove(&name))
            .collect();

        // 3. Merge Pinned Anchors into Exact Target Slots
        let total_count = active_mods.len();
        let mut final_result: Vec<Mod> = Vec::with_capacity(total_count);

        let mut unpinned_idx = 0;
        for pos in 1..=total_count {
            if let Some(pinned_mod) = pinned_entries.remove(&pos) {
                final_result.push(pinned_mod);
            } else if unpinned_idx < unpinned_sorted_mods.len() {
                final_result.push(unpinned_sorted_mods[unpinned_idx].clone());
                unpinned_idx += 1;
            }
        }

        // Append any leftover pinned mods whose target positions exceeded total_count
        for (_, leftover) in pinned_entries {
            final_result.push(leftover);
        }

        final_result
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
    fn test_ascii_pack_name_prioritization() {
        let mods = vec![
            Mod {
                id: "2".into(),
                name: "submod_patch.pack".into(),
                title: "Submod".into(),
                real_path: "/dummy/submod.pack".into(),
                ..Default::default()
            },
            Mod {
                id: "3".into(),
                name: "@@_cbfm_core.pack".into(),
                title: "CBFM".into(),
                real_path: "/dummy/cbfm.pack".into(),
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
        assert_eq!(sorted.len(), 3);
        assert_eq!(sorted[0].name, "!mixer_core.pack");
        assert_eq!(sorted[1].name, "@@_cbfm_core.pack");
        assert_eq!(sorted[2].name, "submod_patch.pack");
    }

    #[test]
    fn test_missing_dependencies_detection() {
        let active = vec![Mod {
            name: "active_mod.pack".into(),
            ..Default::default()
        }];
        let missing = DependencyEngine::find_missing_dependencies(&active);
        // Non-existent dummy paths return empty manifest, so no missing
        assert!(missing.is_empty());
    }

    #[test]
    fn test_pinned_mods_anchoring() {
        let mods = vec![
            Mod {
                name: "aaa_normal.pack".into(),
                ..Default::default()
            },
            Mod {
                name: "zzz_special.pack".into(),
                ..Default::default()
            },
            Mod {
                name: "mmm_middle.pack".into(),
                ..Default::default()
            },
        ];

        // Pin zzz_special to slot #1 (1-indexed)
        let mut pinned = HashMap::new();
        pinned.insert("zzz_special.pack".into(), 1);

        let sorted = DependencyEngine::auto_sort_dependencies_with_rules(&mods, &pinned, &[]);
        assert_eq!(sorted.len(), 3);
        assert_eq!(sorted[0].name, "zzz_special.pack"); // Pinned at #1
        assert_eq!(sorted[1].name, "aaa_normal.pack");
        assert_eq!(sorted[2].name, "mmm_middle.pack");
    }

    #[test]
    fn test_user_override_rules_above() {
        let mods = vec![
            Mod {
                name: "aaa_base.pack".into(),
                ..Default::default()
            },
            Mod {
                name: "zzz_patch.pack".into(),
                ..Default::default()
            },
        ];

        // Custom Rule: zzz_patch must load ABOVE aaa_base
        let rules = vec![UserOverrideRule {
            source_mod: "zzz_patch.pack".into(),
            target_mod: "aaa_base.pack".into(),
            rule_type: RuleType::Above,
        }];

        let sorted =
            DependencyEngine::auto_sort_dependencies_with_rules(&mods, &HashMap::new(), &rules);
        assert_eq!(sorted.len(), 2);
        assert_eq!(sorted[0].name, "zzz_patch.pack"); // User rule forced zzz above aaa
        assert_eq!(sorted[1].name, "aaa_base.pack");
    }
}
