import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText as Text, AppTextInput as TextInput } from '@/components/ui/app-text';
import { AppBadge, AppButton, AppEmptyState, AppPageHeader, appLayoutStyles, appSurfaceStyles } from '@/components/ui/app-ui';
import { colors } from '@/src/view/theme/tokens';
import { UnsavedChangesDialog } from '@/components/ui/unsaved-changes-dialog';
import {
  getCurrentUser,
  getValidAuthSession,
  isAuthSessionError,
  listUsers,
} from '@/src/lib/api/campus';
import type { CampusUser } from '@/src/lib/api/campus';
import { clearAuthToken } from '@/src/lib/auth/token';

type RoleFilter = 'all' | 'student' | 'professor';
type StatusFilter = 'all' | 'active' | 'inactive';

export default function UserListScreen() {
  const router = useRouter();

  const [users, setUsers] = useState<CampusUser[]>([]);
  const [currentUser, setCurrentUser] = useState<CampusUser | null>(null);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isSignOutDialogVisible, setIsSignOutDialogVisible] = useState(false);

  const loadUsers = useCallback(async (refresh = false) => {
    if (refresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    setError(null);
    setProfileError(null);

    try {
      const session = await getValidAuthSession();
      if (session.payload.role !== 'professor' && session.payload.role !== 'admin') {
        router.replace('/(tabs)/(main)' as never);
        return;
      }

      const [usersResult, profileResult] = await Promise.allSettled([
        listUsers(),
        getCurrentUser(),
      ]);

      const usersAuthError =
        usersResult.status === 'rejected' &&
        isAuthSessionError(usersResult.reason);

      const profileAuthError =
        profileResult.status === 'rejected' &&
        isAuthSessionError(profileResult.reason);

      if (usersAuthError || profileAuthError) {
        await clearAuthToken();
        router.replace('/login' as never);
        return;
      }

      if (usersResult.status === 'fulfilled') {
        setUsers(usersResult.value);
      } else {
        setError(
          usersResult.reason instanceof Error
            ? usersResult.reason.message
            : 'Não foi possível carregar os usuários.',
        );
      }

      if (profileResult.status === 'fulfilled') {
        setCurrentUser(profileResult.value);
      } else {
        setProfileError(
          profileResult.reason instanceof Error
            ? profileResult.reason.message
            : 'Não foi possível carregar seu perfil.',
        );
      }
    } catch (requestError) {
      if (isAuthSessionError(requestError)) {
        await clearAuthToken();
        router.replace('/login' as never);
        return;
      }

      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Ocorreu um erro ao carregar os dados.',
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      void loadUsers();
    }, [loadUsers]),
  );

  const filteredUsers = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();

    return users.filter((user) => {
      const fullName =
        `${user.name} ${user.last_name}`.toLocaleLowerCase();
      const email = user.email.toLocaleLowerCase();

      const matchesSearch =
        normalizedSearch.length === 0 ||
        fullName.includes(normalizedSearch) ||
        email.includes(normalizedSearch);

      const matchesRole =
        roleFilter === 'all' || user.role === roleFilter;

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && user.is_active) ||
        (statusFilter === 'inactive' && !user.is_active);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, search, roleFilter, statusFilter]);

  // Alert.alert nao faz nada no react-native-web, entao a confirmacao e um dialogo proprio.
  const handleSignOut = useCallback(async () => {
    setIsSignOutDialogVisible(false);

    try {
      await clearAuthToken();
      router.replace('/login' as never);
    } catch {
      Alert.alert('Erro', 'Não foi possível encerrar a sessão.');
    }
  }, [router]);

  const openStatusFilter = useCallback(() => {
    Alert.alert(
      'Filtrar por status',
      'Quais usuários você deseja visualizar?',
      [
        {
          text: 'Todos',
          onPress: () => setStatusFilter('all'),
        },
        {
          text: 'Ativos',
          onPress: () => setStatusFilter('active'),
        },
        {
          text: 'Inativos',
          onPress: () => setStatusFilter('inactive'),
        },
        {
          text: 'Cancelar',
          style: 'cancel',
        },
      ],
    );
  }, []);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <FlatList
          data={filteredUsers}
          keyExtractor={(user) => String(user.id)}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={
            Platform.OS === 'ios' ? 'interactive' : 'on-drag'
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => void loadUsers(true)}
              colors={['#D0A900']}
              tintColor="#D0A900"
            />
          }
          ListHeaderComponent={
            <View>
              <AppPageHeader
                title="Usuários"
                subtitle="Gerencie sua conta e os acessos ao sistema."
                style={styles.pageHeader}
              />

              {/* Resumo compacto da conta autenticada */}
              <View style={styles.profileCard}>
                <View style={styles.profileRow}>
                  <View style={styles.profileAvatar}>
                    {currentUser?.profile_picture_url ? (
                      <Image
                        source={{
                          uri: currentUser.profile_picture_url,
                        }}
                        contentFit="cover"
                        style={styles.profileAvatarImage}
                      />
                    ) : currentUser ? (
                      <Text style={styles.profileInitials}>
                        {`${currentUser.name.trim().charAt(0)}${currentUser.last_name.trim().charAt(0)}`.toUpperCase()}
                      </Text>
                    ) : (
                      <MaterialIcons
                        name="person"
                        size={25}
                        color={colors.text.primary}
                      />
                    )}
                  </View>

                  <View style={styles.profileInfo}>
                    <Text style={styles.profileName} numberOfLines={1}>
                      {currentUser
                        ? `${currentUser.name} ${currentUser.last_name}`
                        : 'Minha conta'}
                    </Text>

                    <Text style={styles.profileEmail} numberOfLines={1}>
                      {currentUser?.email ?? 'Carregando perfil...'}
                    </Text>

                    {currentUser ? (
                      <Text style={styles.profileRole}>
                        {roleLabel(currentUser.role)}
                      </Text>
                    ) : null}
                  </View>
                </View>

                {profileError ? (
                  <Text style={styles.profileError}>
                    {profileError}
                  </Text>
                ) : null}

                <View style={styles.profileActions}>
                  <AppButton
                    label="Acessar meu perfil"
                    variant="primary"
                    size="sm"
                    disabled={!currentUser}
                    icon={<MaterialIcons name="person-outline" size={17} color={colors.text.primary} />}
                    style={styles.profileActionButton}
                    onPress={() => router.push('/(tabs)/(main)/perfil' as never)}
                  />

                  <AppButton
                    label="Sair"
                    variant="danger"
                    size="sm"
                    icon={<MaterialIcons name="logout" size={17} color={colors.status.danger} />}
                    style={styles.signOutActionButton}
                    onPress={() => setIsSignOutDialogVisible(true)}
                  />
                </View>
              </View>

              {/* Pesquisa e filtros */}
              <View style={styles.searchBox}>
                <MaterialIcons
                  name="search"
                  size={21}
                  color="#8A8D94"
                />

                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Buscar nome ou e-mail"
                  placeholderTextColor="#93979E"
                  style={styles.searchInput}
                  returnKeyType="search"
                  autoCapitalize="none"
                  autoCorrect={false}
                  accessibilityLabel="Buscar usuários por nome ou e-mail"
                />

                {search.length > 0 ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Limpar pesquisa"
                    onPress={() => setSearch('')}
                    hitSlop={8}
                  >
                    <MaterialIcons
                      name="close"
                      size={19}
                      color="#747982"
                    />
                  </Pressable>
                ) : null}
              </View>

              <View style={styles.filtersRow}>
                <FilterChip
                  label="Todos"
                  selected={roleFilter === 'all'}
                  onPress={() => setRoleFilter('all')}
                />

                <FilterChip
                  label="Aluno"
                  selected={roleFilter === 'student'}
                  onPress={() => setRoleFilter('student')}
                />

                <FilterChip
                  label="Professor"
                  selected={roleFilter === 'professor'}
                  onPress={() => setRoleFilter('professor')}
                />

                <FilterChip
                  label={
                    statusFilter === 'all'
                      ? 'Status'
                      : statusFilter === 'active'
                        ? 'Ativos'
                        : 'Inativos'
                  }
                  selected={statusFilter !== 'all'}
                  onPress={openStatusFilter}
                />
              </View>

              <View style={styles.resultsRow}>
                <Text style={styles.resultsCount}>
                  {filteredUsers.length}{' '}
                  {filteredUsers.length === 1
                    ? 'usuário'
                    : 'usuários'}
                </Text>

                {(search ||
                  roleFilter !== 'all' ||
                  statusFilter !== 'all') ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      setSearch('');
                      setRoleFilter('all');
                      setStatusFilter('all');
                    }}
                  >
                    <Text style={styles.clearFilters}>
                      Limpar filtros
                    </Text>
                  </Pressable>
                ) : (
                  <Text style={styles.resultsCaption}>
                    Cadastrados
                  </Text>
                )}
              </View>

              {error ? (
                <View style={styles.errorCard}>
                  <MaterialIcons
                    name="error-outline"
                    size={24}
                    color={colors.status.danger}
                  />

                  <Text style={styles.errorText}>{error}</Text>

                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void loadUsers()}
                  >
                    <Text style={styles.retryText}>
                      Tentar novamente
                    </Text>
                  </Pressable>
                </View>
              ) : null}

              {isLoading && users.length === 0 && !error ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator
                    size="large"
                    color="#D0A900"
                  />

                  <Text style={styles.loadingText}>
                    Carregando usuários...
                  </Text>
                </View>
              ) : null}
            </View>
          }
          renderItem={({ item }) => (
            <UserCard
              user={item}
              onPress={() =>
                router.push({
                  pathname: '/gestao/detalhes/[userId]',
                  params: { userId: String(item.id) },
                } as never)
              }
            />
          )}
          ItemSeparatorComponent={() => (
            <View style={styles.separator} />
          )}
          ListEmptyComponent={
            !isLoading && !error ? (
              <AppEmptyState
                title="Nenhum usuário encontrado"
                description="Experimente mudar a pesquisa ou os filtros."
                icon={<MaterialIcons name="person-search" size={28} color={colors.text.muted} />}
                style={styles.emptyCard}
              />
            ) : null
          }
        />
      </KeyboardAvoidingView>

      <UnsavedChangesDialog
        cancelLabel="Continuar logado"
        confirmLabel="Sair da conta"
        message="Deseja realmente encerrar sua sessão?"
        title="Sair da conta?"
        visible={isSignOutDialogVisible}
        onCancel={() => setIsSignOutDialogVisible(false)}
        onDiscard={() => void handleSignOut()}
      />
    </SafeAreaView>
  );
}

function FilterChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.filterChip,
        selected && styles.filterChipSelected,
      ]}
    >
      <Text
        style={[
          styles.filterChipText,
          selected && styles.filterChipTextSelected,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function UserCard({ user, onPress }: { user: CampusUser; onPress: () => void }) {
  const initials =
    `${user.name.trim().charAt(0)}${user.last_name.trim().charAt(0)}`
      .toUpperCase() || 'U';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Abrir detalhes de ${user.name} ${user.last_name}`}
      onPress={onPress}
      style={styles.userCard}
    >
      <View
        style={[
          styles.userAvatar,
          user.role === 'student' && styles.studentAvatar,
        ]}
      >
        {user.profile_picture_url ? (
          <Image
            source={{ uri: user.profile_picture_url }}
            contentFit="cover"
            style={styles.userAvatarImage}
          />
        ) : (
          <Text style={styles.userAvatarText}>{initials}</Text>
        )}
      </View>

      <View style={styles.userInfo}>
        <Text style={styles.userName} numberOfLines={1}>
          {user.name} {user.last_name}
        </Text>

        <Text style={styles.userEmail} numberOfLines={1}>
          {user.email}
        </Text>

        <View style={styles.badgeRow}>
          <AppBadge variant="neutral">{roleLabel(user.role)}</AppBadge>
          <AppBadge variant={user.is_active ? 'success' : 'danger'}>
            {user.is_active ? 'Ativo' : 'Inativo'}
          </AppBadge>
        </View>
      </View>
      <MaterialIcons name="chevron-right" size={21} color="#9B9EA5" />
    </Pressable>
  );
}

function roleLabel(role: CampusUser['role']) {
  const labels = {
    admin: 'ADMINISTRADOR',
    professor: 'PROFESSOR',
    student: 'ALUNO',
  };

  return labels[role];
}

const styles = StyleSheet.create({
  safeArea: {
    ...appLayoutStyles.screen,
    flex: 1,
  },
  keyboardContainer: {
    flex: 1,
  },
  listContent: {
    ...appLayoutStyles.content,
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 24,
  },
  pageTitle: {
    color: colors.text.primary,
    fontSize: 26,
    fontWeight: '800',
  },
  pageSubtitle: {
    color: colors.text.muted,
    fontSize: 12,
    marginTop: 3,
  },
  pageHeader: { marginBottom: 0 },
  profileCard: {
    ...appSurfaceStyles.card,
    marginTop: 15,
    padding: 13,
  },
  profileRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 11,
  },
  profileAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  profileAvatarImage: {
    width: '100%',
    height: '100%',
  },
  profileInitials: {
    color: colors.text.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  profileInfo: {
    flex: 1,
    gap: 3,
  },
  profileName: {
    color: colors.text.heading,
    fontSize: 13,
    fontWeight: '800',
  },
  profileEmail: {
    color: colors.text.muted,
    fontSize: 11,
  },
  profileRole: {
    color: colors.text.muted,
    fontSize: 9,
    fontWeight: '700',
    marginTop: 2,
  },
  profileActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 13,
  },
  profileActionButton: { flex: 1 },
  signOutActionButton: { flex: 1, minWidth: 0 },
  profileButton: {
    flex: 1,
    minHeight: 39,
    paddingHorizontal: 8,
    borderRadius: 9,
    backgroundColor: colors.brand.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  disabledButton: {
    opacity: 0.5,
  },
  profileButtonText: {
    color: colors.text.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  signOutButton: {
    minHeight: 39,
    paddingHorizontal: 13,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#E7B9B6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  signOutButtonText: {
    color: colors.status.danger,
    fontSize: 12,
    fontWeight: '700',
  },
  profileError: {
    color: colors.status.danger,
    fontSize: 11,
    marginTop: 8,
  },
  searchBox: {
    ...appSurfaceStyles.input,
    minHeight: 48,
    marginTop: 17,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 9,
    color: colors.text.heading,
    fontSize: 12,
  },
  filtersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 12,
  },
  filterChip: {
    minHeight: 30,
    paddingHorizontal: 11,
    borderRadius: 17,
    backgroundColor: colors.neutral.white,
    borderWidth: 1,
    borderColor: '#E2E3E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChipSelected: {
    backgroundColor: colors.brand.primary,
    borderColor: colors.brand.primary,
  },
  filterChipText: {
    color: '#555A61',
    fontSize: 10,
    fontWeight: '600',
  },
  filterChipTextSelected: {
    color: colors.text.primary,
  },
  resultsRow: {
    marginTop: 18,
    marginBottom: 9,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultsCount: {
    color: '#34373D',
    fontSize: 12,
    fontWeight: '700',
  },
  resultsCaption: {
    color: '#858991',
    fontSize: 10,
  },
  clearFilters: {
    color: '#665400',
    fontSize: 11,
    fontWeight: '700',
  },
  userCard: {
    ...appSurfaceStyles.card,
    minHeight: 78,
    paddingHorizontal: 11,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: colors.neutral.white,
    borderWidth: 1,
    borderColor: '#E6E7E9',
    borderRadius: 11,
  },
  userAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#E2E5E3',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  userAvatarImage: {
    width: '100%',
    height: '100%',
  },
  studentAvatar: {
    backgroundColor: colors.brand.primary,
  },
  userAvatarText: {
    color: colors.text.primary,
    fontSize: 11,
    fontWeight: '800',
  },
  userInfo: {
    flex: 1,
    gap: 4,
  },
  userName: {
    color: colors.text.heading,
    fontSize: 13,
    fontWeight: '800',
  },
  userEmail: {
    color: colors.text.muted,
    fontSize: 10,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 5,
    marginTop: 1,
  },
  roleBadge: {
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
    backgroundColor: colors.surface.subtle,
  },
  roleBadgeText: {
    color: '#666B73',
    fontSize: 8,
    fontWeight: '700',
  },
  statusBadge: {
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  statusActive: {
    backgroundColor: colors.status.successSoft,
  },
  statusInactive: {
    backgroundColor: colors.status.dangerSoft,
  },
  statusText: {
    fontSize: 8,
    fontWeight: '800',
  },
  statusActiveText: {
    color: colors.status.success,
  },
  statusInactiveText: {
    color: colors.status.danger,
  },
  separator: {
    height: 7,
  },
  loadingBox: {
    alignItems: 'center',
    gap: 9,
    paddingVertical: 35,
  },
  loadingText: {
    color: '#737780',
    fontSize: 12,
  },
  errorCard: {
    alignItems: 'center',
    gap: 9,
    padding: 15,
    marginTop: 12,
    backgroundColor: '#FDEDEC',
    borderRadius: 11,
  },
  errorText: {
    color: '#8A1C13',
    fontSize: 12,
    textAlign: 'center',
  },
  retryText: {
    color: '#8A1C13',
    fontSize: 12,
    fontWeight: '800',
  },
  emptyCard: {
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    paddingHorizontal: 18,
    paddingVertical: 25,
    backgroundColor: colors.neutral.white,
    borderRadius: 11,
  },
  emptyTitle: {
    color: '#34373D',
    fontSize: 14,
    fontWeight: '800',
  },
  emptyDescription: {
    color: colors.text.muted,
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
  },
});
