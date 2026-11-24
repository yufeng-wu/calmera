Pod::Spec.new do |s|
  s.name = 'CalmeraNative'
  s.version = '0.1.0'
  s.summary = "Calmera's native iOS code"
  s.description = 'Liquid Glass views and tab bar, loopback-only Sign in with ChatGPT with signed identity validation, and selected-photo input.'
  s.author = 'Calmera'
  s.license = 'PolyForm-Noncommercial-1.0.0'
  s.homepage = 'https://github.com/yufeng-wu/calmera'
  s.source = { :git => '' }
  s.platform = :ios, '15.1'
  s.swift_version = '5.9'
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks = 'Network', 'CryptoKit', 'Security', 'PhotosUI', 'AVFoundation'
  s.source_files = '**/*.swift'
end
